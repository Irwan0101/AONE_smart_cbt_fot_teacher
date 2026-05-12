import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import mammoth from 'mammoth';
import {
  Upload, BookOpen, ChevronDown, ChevronUp,
  FileText, CheckCircle, XCircle, RefreshCw, Trash2, Loader2,
  Pencil, Save, X, ArrowLeft,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const MAPEL_LIST = [
  "Al Qur'an Hadits", 'Akidah Akhlak', 'Fikih', 'Bahasa Arab', 'SKI',
  'Bahasa Indonesia', 'Matematika', 'IPA', 'IPS', 'PJOK',
  'SBdP', 'Bahasa Inggris', 'BTQ', 'PABP', 'Bahasa Daerah',
];
const TINGKAT_LIST = ['4', '5', '6'];
const KATEGORI_LIST = ['Ujian Sekolah', 'UTS', 'UAS', 'Latihan', 'Try Out'];

/* ─────────────────────────────────────────
   IMAGE UPLOADER
───────────────────────────────────────── */
const makeImageConverter = (mapelSlug) =>
  mammoth.images.inline(async (element) => {
    try {
      const base64Data = await element.read('base64');
      const mimeType = element.contentType ?? 'image/png';
      const ext = mimeType.split('/')[1].split(';')[0] ?? 'png';
      const fileName = `${mapelSlug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const byteChars = atob(base64Data);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: mimeType });

      const { error: uploadError } = await supabase.storage
        .from('soal-images')
        .upload(fileName, blob, { contentType: mimeType, upsert: false });

      if (uploadError) throw new Error('Upload gambar gagal: ' + uploadError.message);

      const { data: urlData } = supabase.storage.from('soal-images').getPublicUrl(fileName);
      return { src: urlData.publicUrl };
    } catch (err) {
      console.error('Image upload error:', err);
      return { src: '' };
    }
  });

/* ─────────────────────────────────────────
   PARSER
───────────────────────────────────────── */
const parseHtmlToSoal = (htmlString) => {
  const doc = new DOMParser().parseFromString(htmlString, 'text/html');
  const rows = Array.from(doc.querySelectorAll('tr'));
  const extracted = [];
  let currentSoal = null;

  rows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll('td'));
    const col0     = cells[0]?.textContent.trim() ?? '';
    const col1Text = cells[1]?.textContent.trim() ?? '';
    const col1Html = cells[1]?.innerHTML.trim() ?? '';
    const col2Text = cells[2]?.textContent.trim() ?? '';
    const col2Html = cells[2]?.innerHTML.trim() ?? '';

    if (col0 !== '' && !isNaN(col0)) {
      if (currentSoal) extracted.push(currentSoal);
      currentSoal = { no: col0, soal: col1Html, a: '', b: '', c: '', d: '', kunci: '' };
      return;
    }
    if (!currentSoal) return;
    if (col0 === '' && /^[A-Da-d]$/.test(col1Text)) {
      const label = col1Text.toLowerCase();
      if (col2Text !== '' || col2Html.includes('<img')) {
        if (label in currentSoal) currentSoal[label] = col2Html;
      } else {
        currentSoal.kunci = col1Text.toUpperCase();
      }
    }
  });

  if (currentSoal) extracted.push(currentSoal);
  return extracted.filter((s) => s.soal && s.soal.trim() !== '');
};

/* ─────────────────────────────────────────
   SOAL CARD
───────────────────────────────────────── */
const SoalCard = ({ s, idx }) => (
  <div className="px-3 sm:px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2 flex gap-2">
      <span className="text-indigo-500 font-bold shrink-0">{idx + 1}.</span>
      <span
        className="[&_img]:max-w-full [&_img]:rounded [&_img]:my-1"
        dangerouslySetInnerHTML={{ __html: s.soal || s.pertanyaan || '-' }}
      />
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
      {['A', 'B', 'C', 'D'].map(opt => {
        const val     = s[opt.toLowerCase()] || s[`pilihan_${opt.toLowerCase()}`] || '';
        const isKunci = s.kunci === opt;
        return (
          <div
            key={opt}
            className={`flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border ${
              isKunci
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold'
                : 'border-transparent text-gray-500 dark:text-gray-400'
            }`}
          >
            <span className="font-bold shrink-0">{opt}.</span>
            <span
              className="[&_img]:max-w-full [&_img]:rounded"
              dangerouslySetInnerHTML={{ __html: val || '-' }}
            />
            {isKunci && <CheckCircle size={11} className="ml-auto shrink-0 mt-0.5 text-emerald-500" />}
          </div>
        );
      })}
    </div>
  </div>
);

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
export default function BankSoalPage({ session }) {
  const { toast } = useToast();
  const fileRef     = useRef();
  const editFileRef = useRef();

  const [pakets, setPakets]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [importing, setImporting]     = useState(false);
  const [expandedId, setExpandedId]   = useState(null);
  const [soalPreview, setSoalPreview] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [editingPacket, setEditingPacket] = useState(null);
  const [saving, setSaving]               = useState(false);
  const [reimporting, setReimporting]     = useState(false);

  const [parsedSoal, setParsedSoal]     = useState(null);
  const [parsedDetail, setParsedDetail] = useState(null);
  const [showConfirm, setShowConfirm]   = useState(false);

  /* ── Role ── */
  const role       = session?.role;
  const teacherId  = session?.id;
  const isWaliKelas = role === 'wali_kelas';
  const tingkatUser = session?.kelas_wali
    ? session.kelas_wali.replace(/[^0-9]/g, '') // ambil angkanya, misal "5D" → "5"
    : session?.tingkat;

  // Semua role bisa input soal
  const canImport = true;

  // Hanya guru_mapel (pembuat) yang bisa edit/hapus paketnya sendiri
  // Wali kelas bisa edit/hapus paket yang dia buat sendiri
  const canEdit = (p) =>
    role === 'admin' ||
    p.created_by === teacherId;

  /* ─────────────────────────────────────────
     LOAD — filter berdasarkan role
  ───────────────────────────────────────── */
  const loadPakets = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('paket_soal')
        .select('id, mapel, jumlah_soal, status, kategori, tingkat, created_by, created_at')
        .order('created_at', { ascending: false });

      if (isWaliKelas && tingkatUser) {
        // Wali kelas: hanya lihat soal untuk tingkat kelasnya
        query = query.eq('tingkat', tingkatUser);
      } else if (role === 'guru_mapel') {
        // Guru mapel: hanya lihat soal yang dia buat
        query = query.eq('created_by', teacherId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPakets(data || []);
    } catch (e) {
      toast({ type: 'error', title: 'Gagal memuat', message: e.message });
    } finally {
      setLoading(false);
    }
  }, [role, isWaliKelas, tingkatUser, teacherId, toast]);

  useEffect(() => { loadPakets(); }, [loadPakets]);

  /* ─────────────────────────────────────────
     EXPAND PREVIEW
  ───────────────────────────────────────── */
  const handleExpand = async (p) => {
    if (expandedId === p.id) { setExpandedId(null); setSoalPreview([]); return; }
    setExpandedId(p.id);
    setLoadingPreview(true);
    try {
      const { data, error } = await supabase
        .from('paket_soal').select('content_json').eq('id', p.id).single();
      if (error) throw error;
      setSoalPreview(data?.content_json || []);
    } catch {
      setSoalPreview([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  /* ─────────────────────────────────────────
     OPEN EDIT MODE
  ───────────────────────────────────────── */
  const handleOpenEdit = async (p) => {
    const { data, error } = await supabase
      .from('paket_soal').select('*').eq('id', p.id).single();
    if (error) {
      toast({ type: 'error', title: 'Gagal membuka edit', message: error.message });
      return;
    }
    setEditingPacket(data);
    setExpandedId(null);
    setSoalPreview([]);
  };

  /* ─────────────────────────────────────────
     RE-IMPORT WORD (saat edit)
  ───────────────────────────────────────── */
  const handleReimportWord = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.name.endsWith('.docx')) {
      toast({ type: 'warning', title: 'Format salah', message: 'Hanya file .docx yang didukung' });
      return;
    }
    setReimporting(true);
    try {
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
      const mapelSlug = editingPacket.mapel.replace(/\s+/g, '-').toLowerCase();
      const result    = await mammoth.convertToHtml({ arrayBuffer }, { convertImage: makeImageConverter(mapelSlug) });
      const soalArr   = parseHtmlToSoal(result.value);
      if (!soalArr.length) throw new Error('Tidak ada soal yang berhasil dibaca.');
      setEditingPacket(prev => ({ ...prev, content_json: soalArr, jumlah_soal: soalArr.length }));
      toast({ type: 'success', title: 'Soal diperbarui', message: `${soalArr.length} soal berhasil dibaca` });
    } catch (e) {
      toast({ type: 'error', title: 'Gagal re-import', message: e.message });
    } finally {
      setReimporting(false);
    }
  };

  /* ─────────────────────────────────────────
     SAVE UPDATE (edit mode)
  ───────────────────────────────────────── */
  const handleUpdatePacket = async () => {
    if (!editingPacket) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('paket_soal')
        .update({
          mapel:        editingPacket.mapel,
          kategori:     editingPacket.kategori,
          tingkat:      editingPacket.tingkat,
          content_json: editingPacket.content_json,
          jumlah_soal:  editingPacket.content_json.length,
        })
        .eq('id', editingPacket.id);
      if (error) throw error;
      toast({ type: 'success', title: 'Tersimpan!', message: `${editingPacket.mapel} berhasil diperbarui` });
      setEditingPacket(null);
      loadPakets();
    } catch (e) {
      toast({ type: 'error', title: 'Gagal menyimpan', message: e.message });
    } finally {
      setSaving(false);
    }
  };

  /* ─────────────────────────────────────────
     IMPORT WORD — TAHAP 1
  ───────────────────────────────────────── */
  const handleImportWord = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.name.endsWith('.docx')) {
      toast({ type: 'warning', title: 'Format salah', message: 'Hanya file .docx yang didukung' });
      return;
    }

const { value: detail } = await Swal.fire({
      title: 'Detail Paket Soal',
      html: `
        <div style="text-align:left;display:flex;flex-direction:column;gap:12px;margin-top:8px">
          <div>
            <label style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px">Mata Pelajaran</label>
            <select id="swal-mapel" style="width:100%;padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;background:#f9fafb">
              <option value="">Pilih mapel...</option>
              ${MAPEL_LIST.map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px">Tingkat / Kelas</label>
            ${isWaliKelas && tingkatUser
              ? `<input disabled value="Kelas ${tingkatUser}"
                   style="width:100%;padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;background:#f0f0f0;color:#6b7280;box-sizing:border-box" />`
              : `<select id="swal-tingkat" style="width:100%;padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;background:#f9fafb">
                   <option value="">Pilih tingkat...</option>
                   ${TINGKAT_LIST.map(t => `<option value="${t}">Kelas ${t}</option>`).join('')}
                 </select>`
            }
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px">Kategori</label>
            <select id="swal-kat" style="width:100%;padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;background:#f9fafb">
              ${KATEGORI_LIST.map(k => `<option value="${k}">${k}</option>`).join('')}
            </select>
          </div>
        </div>
      `,
      confirmButtonText: `
        <span style="display:inline-flex;align-items:center;gap:7px;pointer-events:none">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          Proses
        </span>`,
      cancelButtonText: `
        <span style="display:inline-flex;align-items:center;gap:7px;pointer-events:none">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Batal
        </span>`,
      showCancelButton: true,
      confirmButtonColor: undefined,
      cancelButtonColor:  undefined,
      customClass: {
        confirmButton: 'swal-btn-proses',
        cancelButton:  'swal-btn-batal',
        actions:       'swal-actions-wrap',
      },
      didOpen: () => {
        if (!document.getElementById('swal-custom-style')) {
          const style = document.createElement('style');
          style.id = 'swal-custom-style';
          style.textContent = `
            /* Actions row */
            .swal-actions-wrap {
              display: flex !important;
              justify-content: center !important;
              gap: 12px !important;
              margin-top: 24px !important;
              padding: 0 4px !important;
            }

            /* Base shared */
            .swal-btn-proses,
            .swal-btn-batal {
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              min-width: 120px !important;
              padding: 10px 24px !important;
              border-radius: 12px !important;
              font-size: 13.5px !important;
              font-weight: 700 !important;
              letter-spacing: 0.01em !important;
              border: none !important;
              cursor: pointer !important;
              transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease !important;
            }
            .swal-btn-proses:active,
            .swal-btn-batal:active {
              transform: scale(0.97) !important;
            }

            /* Proses — biru */
            .swal-btn-proses {
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
              color: #fff !important;
              box-shadow: 0 4px 12px rgba(59,130,246,0.40), 0 1px 3px rgba(59,130,246,0.20) !important;
            }
            .swal-btn-proses:hover {
              filter: brightness(1.08) !important;
              box-shadow: 0 6px 18px rgba(59,130,246,0.45), 0 2px 6px rgba(59,130,246,0.25) !important;
            }
            .swal-btn-proses:focus {
              outline: none !important;
              box-shadow: 0 0 0 3px rgba(59,130,246,0.35) !important;
            }

            /* Batal — merah */
            .swal-btn-batal {
              background: linear-gradient(135deg, #f87171 0%, #ef4444 100%) !important;
              color: #fff !important;
              box-shadow: 0 4px 12px rgba(239,68,68,0.35), 0 1px 3px rgba(239,68,68,0.18) !important;
            }
            .swal-btn-batal:hover {
              filter: brightness(1.08) !important;
              box-shadow: 0 6px 18px rgba(239,68,68,0.40), 0 2px 6px rgba(239,68,68,0.22) !important;
            }
            .swal-btn-batal:focus {
              outline: none !important;
              box-shadow: 0 0 0 3px rgba(239,68,68,0.35) !important;
            }
          `;
          document.head.appendChild(style);
        }
      },
      preConfirm: () => {
        const mapel   = document.getElementById('swal-mapel').value;
        const tingkat = isWaliKelas && tingkatUser
          ? tingkatUser
          : document.getElementById('swal-tingkat').value;
        const kat = document.getElementById('swal-kat').value;
        if (!mapel || !tingkat) {
          Swal.showValidationMessage('Mapel dan tingkat wajib diisi');
          return false;
        }
        return { mapel, tingkat, kategori: kat };
      },
    });
    if (!detail) return;

    setImporting(true);
    try {
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      const mapelSlug = detail.mapel.replace(/\s+/g, '-').toLowerCase();
      const result    = await mammoth.convertToHtml({ arrayBuffer }, { convertImage: makeImageConverter(mapelSlug) });
      const soalArr   = parseHtmlToSoal(result.value);
      if (!soalArr.length) throw new Error('Tidak ada soal yang berhasil dibaca. Periksa format tabel.');

      setParsedSoal(soalArr);
      setParsedDetail(detail);
      setShowConfirm(true);
    } catch (e) {
      toast({ type: 'error', title: 'Import gagal', message: e.message });
    } finally {
      setImporting(false);
    }
  };

  /* ─────────────────────────────────────────
     IMPORT WORD — TAHAP 2: publish
  ───────────────────────────────────────── */
  const handleSaveParsed = async () => {
    if (!parsedSoal || !parsedDetail) return;
    setImporting(true);
    try {
      const { error } = await supabase.from('paket_soal').insert({
        mapel:        parsedDetail.mapel,
        tingkat:      parsedDetail.tingkat,
        kategori:     parsedDetail.kategori,
        jumlah_soal:  parsedSoal.length,
        status:       'Aktif',
        content_json: parsedSoal,
        created_by:   teacherId,
      });
      if (error) throw error;
      toast({ type: 'success', title: 'Import berhasil!', message: `${parsedSoal.length} soal ${parsedDetail.mapel} kelas ${parsedDetail.tingkat} tersimpan` });
      setShowConfirm(false);
      setParsedSoal(null);
      setParsedDetail(null);
      loadPakets();
    } catch (e) {
      toast({ type: 'error', title: 'Gagal menyimpan', message: e.message });
    } finally {
      setImporting(false);
    }
  };

  const handleCancelConfirm = () => {
    setShowConfirm(false);
    setParsedSoal(null);
    setParsedDetail(null);
  };

  /* ─────────────────────────────────────────
     DELETE
  ───────────────────────────────────────── */
  const handleDelete = async (p) => {
    if (!canEdit(p)) return;

    const res = await Swal.fire({
      title: 'Hapus Paket Soal?',
      html: `<b>${p.mapel}</b> (${p.jumlah_soal} soal) akan dihapus permanen`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    });
    if (!res.isConfirmed) return;

    try {
      const { data: paketData } = await supabase
        .from('paket_soal').select('content_json').eq('id', p.id).single();

      if (paketData?.content_json?.length) {
        const allHtml    = paketData.content_json.flatMap(s => [s.soal, s.a, s.b, s.c, s.d]).filter(Boolean).join(' ');
        const urlMatches = [...allHtml.matchAll(/src="([^"]*soal-images[^"]*)"/g)];
        const filePaths  = urlMatches.map(m => {
          const split = m[1].split('/soal-images/');
          return split[1] ? decodeURIComponent(split[1]) : null;
        }).filter(Boolean);
        if (filePaths.length > 0) {
          await supabase.storage.from('soal-images').remove(filePaths);
        }
      }

      const { error } = await supabase.from('paket_soal').delete().eq('id', p.id);
      if (error) throw error;
      toast({ type: 'success', title: 'Paket dihapus', message: p.mapel });
      if (expandedId === p.id) { setExpandedId(null); setSoalPreview([]); }
      loadPakets();
    } catch (e) {
      toast({ type: 'error', title: 'Gagal menghapus', message: e.message });
    }
  };

  /* ─────────────────────────────────────────
     TOGGLE STATUS
  ───────────────────────────────────────── */
  const toggleStatus = async (p) => {
    if (!canEdit(p)) return;
    const newStatus = p.status === 'Aktif' ? 'Draft' : 'Aktif';
    try {
      const { error } = await supabase.from('paket_soal').update({ status: newStatus }).eq('id', p.id);
      if (error) throw error;
      setPakets(prev => prev.map(x => x.id === p.id ? { ...x, status: newStatus } : x));
      toast({ type: 'info', title: 'Status diubah', message: `${p.mapel} → ${newStatus}` });
    } catch (e) {
      toast({ type: 'error', title: 'Gagal', message: e.message });
    }
  };

  /* ─────────────────────────────────────────
     RENDER — EDIT MODE
  ───────────────────────────────────────── */
  if (editingPacket) {
    return (
      <div className="space-y-4 sm:space-y-5">
        {/* Edit header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditingPacket(null)}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">Edit Paket Soal</h2>
              <p className="text-xs text-gray-400 mt-0.5">{editingPacket.content_json?.length ?? 0} soal</p>
            </div>
          </div>
          {/* Edit action buttons — wrap di mobile */}
          <div className="flex flex-wrap gap-2 pl-11 sm:pl-0">
            <input ref={editFileRef} type="file" accept=".docx" onChange={handleReimportWord} className="hidden" />
            <button
              onClick={() => editFileRef.current?.click()}
              disabled={reimporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                         border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300
                         hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60 transition-all"
            >
              {reimporting
                ? <><Loader2 size={13} className="animate-spin" /> Memproses...</>
                : <><Upload size={13} /> Ganti Soal (Word)</>
              }
            </button>
            <button
              onClick={() => setEditingPacket(null)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                         border border-gray-200 dark:border-gray-700 text-gray-500
                         hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              <X size={13} /> Batal
            </button>
            <button
              onClick={handleUpdatePacket}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold
                         bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60
                         text-white shadow-md shadow-indigo-500/30 transition-all"
            >
              {saving
                ? <><Loader2 size={13} className="animate-spin" /> Menyimpan...</>
                : <><Save size={13} /> Simpan</>
              }
            </button>
          </div>
        </div>

        {/* Edit fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Mata Pelajaran</label>
            <select
              value={editingPacket.mapel}
              onChange={e => setEditingPacket(prev => ({ ...prev, mapel: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900
                         text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {MAPEL_LIST.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tingkat</label>
            <select
              value={editingPacket.tingkat}
              disabled={isWaliKelas}
              onChange={e => setEditingPacket(prev => ({ ...prev, tingkat: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900
                         text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400
                         disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
            >
              {TINGKAT_LIST.map(t => <option key={t} value={t}>Kelas {t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Kategori</label>
            <select
              value={editingPacket.kategori}
              onChange={e => setEditingPacket(prev => ({ ...prev, kategori: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900
                         text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {KATEGORI_LIST.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>

        {/* Soal list */}
        <div className="space-y-3">
          {(editingPacket.content_json || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <FileText size={36} className="text-gray-200 dark:text-gray-700" />
              <p className="text-sm text-gray-400 text-center">Belum ada soal — klik &quot;Ganti Soal (Word)&quot; untuk upload</p>
            </div>
          ) : (
            (editingPacket.content_json || []).map((s, idx) => (
              <SoalCard key={idx} s={s} idx={idx} />
            ))
          )}
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────
     RENDER — LIST MODE
  ───────────────────────────────────────── */
  return (
    <div className="space-y-4 sm:space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">Bank Soal</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {pakets.length} paket soal
            {isWaliKelas && tingkatUser && ` · Kelas ${tingkatUser}`}
            {role === 'guru_mapel' && ' · Soal Anda'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={loadPakets}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500
                       hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          {/* Semua role bisa import */}
          <input ref={fileRef} type="file" accept=".docx" onChange={handleImportWord} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold
                       bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60
                       text-white shadow-md shadow-emerald-500/30 transition-all"
          >
            {importing
              ? <><Loader2 size={14} className="animate-spin" /> Memproses...</>
              : <><Upload size={14} /> Import Word</>
            }
          </button>
        </div>
      </div>

      {/* Template info */}
      <div className="flex items-start gap-3 px-3 sm:px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
        <FileText size={15} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300">Format Template Word</p>
          <p className="text-[11px] text-blue-500 dark:text-blue-400 mt-1">
            Tabel dengan kolom: No | Soal | (A/B/C/D/Kunci). Gambar di soal/pilihan otomatis diupload ke storage.
          </p>
          <a
            href="/soal_temp.docx"
            download="Template_Soal.docx"
            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-[11px] font-bold
                       bg-blue-500 hover:bg-blue-600 text-white transition-all"
          >
            <FileText size={12} /> Download Template
          </a>
        </div>
      </div>

      {/* Paket list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : pakets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-20 gap-3">
          <BookOpen size={40} className="text-gray-200 dark:text-gray-700" />
          <p className="text-sm font-semibold text-gray-400">Belum ada paket soal</p>
          <p className="text-xs text-gray-300 dark:text-gray-600 text-center">
            Klik &quot;Import Word&quot; untuk menambah soal
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pakets.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
            >
              {/* Paket row */}
              <div className="flex items-center gap-3 px-3 sm:px-5 py-3 sm:py-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-base sm:text-lg shrink-0">
                  📚
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">{p.mapel}</span>
                    {p.tingkat && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shrink-0">
                        Kls {p.tingkat}
                      </span>
                    )}
                    {p.kategori && (
                      <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400">
                        {p.kategori}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                    {p.jumlah_soal} soal • {new Date(p.created_at).toLocaleDateString('id-ID')}
                    {p.kategori && <span className="sm:hidden"> • {p.kategori}</span>}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {/* Status toggle — hanya pemilik */}
                  {canEdit(p) && (
                    <button
                      onClick={() => toggleStatus(p)}
                      className={`hidden sm:flex px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                        p.status === 'Aktif'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {p.status === 'Aktif'
                        ? <><CheckCircle size={11} className="inline mr-1" />Aktif</>
                        : <><XCircle size={11} className="inline mr-1" />Draft</>
                      }
                    </button>
                  )}
                  {/* Status indicator mobile (tidak bisa diklik, hanya info) */}
                  {!canEdit(p) && (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${p.status === 'Aktif' ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  )}

                  <button
                    onClick={() => handleExpand(p)}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {expandedId === p.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>

                  {canEdit(p) && (
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                  )}

                  {canEdit(p) && (
                    <button
                      onClick={() => handleDelete(p)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile: status toggle bar (hanya pemilik) */}
              {canEdit(p) && (
                <div className="sm:hidden px-3 pb-2.5 flex items-center gap-2">
                  <button
                    onClick={() => toggleStatus(p)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                      p.status === 'Aktif'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {p.status === 'Aktif'
                      ? <><CheckCircle size={10} />Aktif</>
                      : <><XCircle size={10} />Draft</>
                    }
                  </button>
                </div>
              )}

              {/* Preview expand */}
              <AnimatePresence>
                {expandedId === p.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-gray-100 dark:border-gray-800"
                  >
                    <div className="p-3 sm:p-4 max-h-[420px] sm:max-h-[480px] overflow-y-auto space-y-3">
                      {loadingPreview ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-xs">
                          <Loader2 size={16} className="animate-spin" /> Memuat soal...
                        </div>
                      ) : soalPreview.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">Tidak ada data preview</p>
                      ) : (
                        soalPreview.map((s, idx) => <SoalCard key={idx} s={s} idx={idx} />)
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal konfirmasi publish */}
      <AnimatePresence>
        {showConfirm && parsedSoal && parsedDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="bg-white dark:bg-gray-900 w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Siap Dipublish</h3>
                <button
                  onClick={handleCancelConfirm}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Handle bar — mobile */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700 sm:hidden" />

              <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {parsedDetail.mapel} · Kelas {parsedDetail.tingkat}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{parsedDetail.kategori}</p>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  ✓ {parsedSoal.length} soal berhasil diproses &amp; gambar terupload
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCancelConfirm}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-gray-200 dark:border-gray-700
                             text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveParsed}
                  disabled={importing}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-600
                             disabled:opacity-60 text-white shadow-md shadow-indigo-500/30 transition-all
                             flex items-center justify-center gap-1.5"
                >
                  {importing
                    ? <><Loader2 size={12} className="animate-spin" /> Menyimpan...</>
                    : <><Upload size={12} /> Publish ke Cloud</>
                  }
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}