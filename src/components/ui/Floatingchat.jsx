import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { MessageCircle, X, Send, ChevronLeft, Circle } from 'lucide-react';


// ─────────────────────────────────────────
// Props yang dibutuhkan:
//
// Untuk teacher (login manual):
//   session = { id: teachers.id, nama: 'Nama Guru', role: 'guru_mapel' | 'wali_kelas' }
//
// Untuk admin (login via Supabase Auth):
//   session = { id: auth.user.id, nama: 'Admin', role: 'admin' }
//
// Contoh pemakaian di App.jsx / layout:
//   <FloatingChat session={session} />
// ─────────────────────────────────────────

export default function FloatingChat({ session }) {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const [unread, setUnread]       = useState(0);
  const [rooms, setRooms]         = useState([]);   // hanya admin
  const [activeRoom, setActiveRoom] = useState(null); // hanya admin
  const bottomRef = useRef(null);
  const channelRef = useRef(null);

  const isAdmin = session?.role === 'admin';

  // ── Scroll ke bawah saat pesan bertambah
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // ── Hitung unread saat tidak terbuka
  useEffect(() => {
    if (!session?.id) return;
    fetchUnread();
  }, [session?.id, open]);

  // ── Load messages & realtime
  useEffect(() => {
    if (!session?.id) return;
    if (!open) return;

    if (isAdmin && !activeRoom) {
      loadRooms();
      return;
    }

    const roomId = isAdmin ? activeRoom : session.id;
    loadMessages(roomId);
    subscribeRoom(roomId);

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [open, activeRoom, session?.id]);

  // ── Mark as read saat buka room (untuk admin)
  useEffect(() => {
    if (!open || !isAdmin || !activeRoom) return;
    markRead(activeRoom);
  }, [open, activeRoom]);

  // ── Mark as read untuk teacher saat buka chat
  useEffect(() => {
    if (!open || isAdmin) return;
    markReadTeacher(session.id);
  }, [open]);

  async function fetchUnread() {
    if (isAdmin) {
      // Admin: hitung semua pesan belum dibaca dari non-admin
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .neq('sender_role', 'admin');
      setUnread(count ?? 0);
    } else {
      // Teacher: hitung pesan dari admin di room sendiri yang belum dibaca
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', session.id)
        .eq('sender_role', 'admin')
        .eq('is_read', false);
      setUnread(count ?? 0);
    }
  }

  async function loadRooms() {
    // Admin: ambil daftar room (distinct room_id) dengan pesan terbaru
    const { data } = await supabase
      .from('chat_messages')
      .select('room_id, sender_name, created_at, message, is_read, sender_role')
      .order('created_at', { ascending: false });

    if (!data) return;

    // Group by room_id, ambil pesan terbaru per room
    const roomMap = {};
    for (const msg of data) {
      if (!roomMap[msg.room_id]) {
        roomMap[msg.room_id] = {
          room_id: msg.room_id,
          last_message: msg.message,
          last_time: msg.created_at,
          teacher_name: msg.sender_role !== 'admin' ? msg.sender_name : null,
          has_unread: msg.sender_role !== 'admin' && !msg.is_read,
        };
      } else if (msg.sender_role !== 'admin' && !msg.is_read) {
        roomMap[msg.room_id].has_unread = true;
      }
      if (!roomMap[msg.room_id].teacher_name && msg.sender_role !== 'admin') {
        roomMap[msg.room_id].teacher_name = msg.sender_name;
      }
    }

    // Untuk room yang hanya ada pesan dari admin, ambil nama dari teachers
    const roomIds = Object.keys(roomMap).filter(id => !roomMap[id].teacher_name);
    if (roomIds.length) {
      const { data: teachers } = await supabase
        .from('teachers')
        .select('id, nama')
        .in('id', roomIds);
      teachers?.forEach(t => {
        if (roomMap[t.id]) roomMap[t.id].teacher_name = t.nama;
      });
    }

    setRooms(Object.values(roomMap).sort((a, b) =>
      new Date(b.last_time) - new Date(a.last_time)
    ));
  }

  async function loadMessages(roomId) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);
  }

  function subscribeRoom(roomId) {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const ch = supabase
      .channel(`chat_room_${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        // Mark read otomatis kalau chat sedang terbuka
        if (isAdmin) markRead(roomId);
        else markReadTeacher(roomId);
      })
      .subscribe();

    channelRef.current = ch;
  }

  async function markRead(roomId) {
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('room_id', roomId)
      .neq('sender_role', 'admin');
    fetchUnread();
  }

  async function markReadTeacher(roomId) {
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('room_id', roomId)
      .eq('sender_role', 'admin');
    fetchUnread();
  }

  async function sendMessage() {
    if (!input.trim() || sending) return;
    const roomId = isAdmin ? activeRoom : session.id;
    if (!roomId) return;

    setSending(true);
    const { error } = await supabase.from('chat_messages').insert({
      room_id:     roomId,
      sender_id:   session.id,
      sender_name: session.nama,
      sender_role: session.role,
      message:     input.trim(),
    });
    if (!error) setInput('');
    setSending(false);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Hari ini';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  // ── Kelompokkan pesan per tanggal
  function groupByDate(msgs) {
    const groups = [];
    let lastDate = null;
    for (const m of msgs) {
      const d = new Date(m.created_at).toDateString();
      if (d !== lastDate) {
        groups.push({ type: 'date', label: formatDate(m.created_at) });
        lastDate = d;
      }
      groups.push({ type: 'msg', data: m });
    }
    return groups;
  }

  if (!session) return null;

  return (
    <>
      {/* ── Floating Bubble ── */}
      <button
        onClick={() => { setOpen(o => !o); if (!open && isAdmin && !activeRoom) loadRooms(); }}
        className="fixed bottom-6 right-6 z-[200] w-14 h-14 rounded-full
                   bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl shadow-indigo-500/40
                   flex items-center justify-center transition-all duration-200
                   hover:scale-110 active:scale-95"
      >
        {open
          ? <X size={22} />
          : <MessageCircle size={22} />
        }
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full
                           bg-red-500 text-white text-[10px] font-bold
                           flex items-center justify-center shadow-lg">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* ── Chat Window ── */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[199] w-[340px] max-h-[520px]
                        bg-white dark:bg-gray-900 rounded-2xl shadow-2xl shadow-black/20
                        border border-gray-200 dark:border-gray-700
                        flex flex-col overflow-hidden
                        animate-in slide-in-from-bottom-4 fade-in duration-200">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3
                          bg-indigo-600 text-white shrink-0">
            {isAdmin && activeRoom && (
              <button
                onClick={() => { setActiveRoom(null); setMessages([]); loadRooms(); }}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">
                {isAdmin
                  ? (activeRoom
                    ? (rooms.find(r => r.room_id === activeRoom)?.teacher_name ?? 'Chat')
                    : 'Pesan Masuk')
                  : 'Chat dengan Admin'}
              </p>
              <p className="text-[10px] text-indigo-200 leading-tight mt-0.5">
                {isAdmin && !activeRoom
                  ? `${rooms.length} percakapan`
                  : 'Online'}
              </p>
            </div>
            <Circle size={8} className="fill-emerald-400 text-emerald-400 shrink-0" />
          </div>

          {/* ── Admin: daftar room ── */}
          {isAdmin && !activeRoom && (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {rooms.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                  <MessageCircle size={32} className="mb-2 opacity-30" />
                  <p className="text-xs">Belum ada pesan masuk</p>
                </div>
              )}
              {rooms.map(room => (
                <button
                  key={room.room_id}
                  onClick={() => setActiveRoom(room.room_id)}
                  className="w-full flex items-start gap-3 px-4 py-3
                             hover:bg-gray-50 dark:hover:bg-gray-800
                             transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900
                                  flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-300">
                      {(room.teacher_name ?? '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-semibold truncate
                                     ${room.has_unread
                                       ? 'text-gray-900 dark:text-white'
                                       : 'text-gray-600 dark:text-gray-300'}`}>
                        {room.teacher_name ?? '(tanpa nama)'}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {formatTime(room.last_time)}
                      </span>
                    </div>
                    <p className={`text-[11px] truncate mt-0.5
                                   ${room.has_unread
                                     ? 'text-gray-700 dark:text-gray-200 font-medium'
                                     : 'text-gray-400'}`}>
                      {room.last_message}
                    </p>
                  </div>
                  {room.has_unread && (
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── Chat messages (teacher atau admin sudah pilih room) ── */}
          {(!isAdmin || activeRoom) && (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1
                              bg-gray-50 dark:bg-gray-950 min-h-0">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                    <MessageCircle size={28} className="mb-2 opacity-30" />
                    <p className="text-[11px]">Belum ada pesan. Mulai percakapan!</p>
                  </div>
                )}

                {groupByDate(messages).map((item, idx) => {
                  if (item.type === 'date') {
                    return (
                      <div key={`date-${idx}`} className="flex items-center gap-2 py-2">
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                        <span className="text-[10px] text-gray-400 px-2">{item.label}</span>
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                      </div>
                    );
                  }

                  const msg = item.data;
                  const isMine = msg.sender_id === session.id;

                  return (
                    <div key={msg.id}
                         className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs leading-relaxed
                                       ${isMine
                                         ? 'bg-indigo-600 text-white rounded-br-sm'
                                         : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm rounded-bl-sm border border-gray-100 dark:border-gray-700'}`}>
                        {!isMine && (
                          <p className="text-[10px] font-bold mb-0.5
                                        text-indigo-500 dark:text-indigo-400">
                            {msg.sender_name}
                          </p>
                        )}
                        <p className="break-words whitespace-pre-wrap">{msg.message}</p>
                        <p className={`text-[9px] mt-1 text-right
                                       ${isMine ? 'text-indigo-200' : 'text-gray-400'}`}>
                          {formatTime(msg.created_at)}
                          {isMine && (
                            <span className="ml-1">
                              {msg.is_read ? '✓✓' : '✓'}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="flex items-end gap-2 px-3 py-3 border-t
                              border-gray-200 dark:border-gray-700 shrink-0
                              bg-white dark:bg-gray-900">
                <textarea
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ketik pesan... (Enter kirim)"
                  className="flex-1 resize-none rounded-xl border border-gray-200
                             dark:border-gray-700 bg-gray-50 dark:bg-gray-800
                             px-3 py-2 text-xs text-gray-800 dark:text-gray-100
                             focus:outline-none focus:ring-2 focus:ring-indigo-400
                             placeholder-gray-400 max-h-24 min-h-[36px]"
                  style={{ height: 'auto' }}
                  onInput={e => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700
                             disabled:opacity-40 disabled:cursor-not-allowed
                             text-white flex items-center justify-center
                             transition-all active:scale-90 shrink-0"
                >
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}