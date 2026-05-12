import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo.jpg';
import foto from '../assets/irwan.jpeg';
import appScreenshot from '../assets/aplikasiku.png'; // foto laptop+HP yang diupload

/* ── pakai foto screenshot yang diupload jika ada, fallback ke mockup ── */
/* Ganti import appScreenshot di atas dengan path foto aslimu:
   import appScreenshot from '../assets/Gemini_Generated_Image_o4newko4newko4ne__1_.png';
   atau nama file foto laptop+HP-mu */

const FEATURES = [
  { icon: '⚡', title: 'Performa Kilat', desc: 'Ujian online tanpa lag, stabil & responsif' },
  { icon: '🛡️', title: 'Anti-Contek', desc: 'Token pengawas & lockdown browser terintegrasi' },
  { icon: '📊', title: 'Rekap Otomatis', desc: 'Nilai langsung tersaji begitu ujian selesai' },
  { icon: '📱', title: 'Multi-Perangkat', desc: 'Bisa diakses dari HP, tablet, maupun laptop' },
];

const STEPS = [
  { n: '1', title: 'Buat paket soal', desc: 'Upload soal, atur waktu & jadwal dari dashboard guru' },
  { n: '2', title: 'Bagikan token', desc: 'Token unik dibagikan saat ujian — tanpa token siswa tidak bisa masuk' },
  { n: '3', title: 'Nilai otomatis', desc: 'Rekap nilai tersedia real-time begitu ujian selesai' },
];

/* ── Shared styles ── */
const S = {
  page: {
    minHeight: '100vh',
    fontFamily: "'Nunito', 'Segoe UI', system-ui, sans-serif",
    position: 'relative',
    overflowX: 'hidden',
  },
  fadeIn: (v) => ({ opacity: v ? 1 : 0, transition: 'opacity 0.45s ease' }),
};

/* ══════════════════════════════════════
   WELCOME SCREEN — Landing Page Style
══════════════════════════════════════ */
function WelcomeScreen({ onEnter }) {
  const [visible, setVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = heroRef.current?.closest('[data-scroll]') || window;
    const onScroll = () => setScrolled((el.scrollY || el.scrollTop || 0) > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleEnter = () => { setVisible(false); setTimeout(onEnter, 380); };

  return (
    <div style={{ ...S.page, ...S.fadeIn(visible), background: '#f0f9f5' }}>

      {/* ── Sticky nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: scrolled ? 'rgba(240,249,245,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(29,158,117,0.15)' : '1px solid transparent',
        transition: 'all 0.3s ease',
        padding: '14px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logo} alt="AONE Smart CBT" style={{ height: 36, objectFit: 'contain' }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0a2e22', letterSpacing: '-0.2px' }}>
            AONE Smart CBT
          </span>
        </div>
        <button onClick={handleEnter} style={{
          padding: '8px 20px', borderRadius: 10, border: 'none',
          background: '#1d9e75', color: '#fff', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', letterSpacing: '0.02em',
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = '#0f6e56'}
          onMouseLeave={e => e.currentTarget.style.background = '#1d9e75'}
        >
          Portal Guru →
        </button>
      </nav>

      {/* ── Hero ── */}
      <section ref={heroRef} style={{
        background: 'linear-gradient(170deg, #e8f5ef 0%, #d4eee4 50%, #e0f0f8 100%)',
        padding: '56px 24px 0',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative orbs */}
        <div style={{ position:'absolute', top:-60, right:-60, width:260, height:260, borderRadius:'50%', background:'rgba(29,158,117,0.08)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:80, left:-80, width:200, height:200, borderRadius:'50%', background:'rgba(56,139,253,0.07)', pointerEvents:'none' }} />

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#1d9e75', color: '#e1f5ee',
          fontSize: 11, fontWeight: 800, padding: '5px 14px',
          borderRadius: 20, marginBottom: 20, letterSpacing: '0.06em',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7dd3b0', display: 'inline-block' }} />
          MIN 2 Sarolangun · Jambi · 2026
        </div>

        <h1 style={{
          fontSize: 'clamp(26px, 5vw, 40px)',
          fontWeight: 900, color: '#0a2e22',
          letterSpacing: '-1px', lineHeight: 1.15,
          margin: '0 auto 16px', maxWidth: 560,
        }}>
          Platform Ujian Digital<br />
          <span style={{ color: '#1d9e75' }}>AONE Smart CBT</span>
        </h1>

        <p style={{
          fontSize: 15, color: '#2d5a4a', lineHeight: 1.75,
          maxWidth: 420, margin: '0 auto 28px',
        }}>
          Solusi ujian online cepat, aman, dan mudah — dilengkapi anti-contek &amp; rekap nilai otomatis untuk guru Indonesia.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 40, flexWrap: 'wrap' }}>
          <button onClick={handleEnter} style={{
            padding: '13px 28px', borderRadius: 12, border: 'none',
            background: '#1d9e75', color: '#fff',
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(29,158,117,0.3)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 10px 28px rgba(29,158,117,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(29,158,117,0.3)'; }}
          >
            Masuk Portal Guru →
          </button>
          <button style={{
            padding: '13px 24px', borderRadius: 12,
            border: '1.5px solid #1d9e75', background: 'transparent',
            color: '#0f6e56', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            Lihat Demo
          </button>
        </div>

        {/* ── App Screenshot ── */}
        <div style={{
          maxWidth: 680, margin: '0 auto',
          borderRadius: '20px 20px 0 0',
          overflow: 'hidden',
          boxShadow: '0 -4px 40px rgba(10,46,34,0.15)',
          border: '1px solid rgba(29,158,117,0.2)',
          borderBottom: 'none',
          position: 'relative',
        }}>
          {/* Gunakan foto asli laptop+HP yang diupload */}
          <img
            src={appScreenshot}
            alt="AONE Smart CBT — tampilan dashboard guru dan aplikasi siswa"
            style={{ width: '100%', display: 'block', objectFit: 'cover' }}
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
          {/* Fallback jika foto tidak ditemukan */}
          <div style={{
            display: 'none', background: '#1d4a2e', height: 260,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 10,
          }}>
            <span style={{ fontSize: 40 }}>💻📱</span>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              Ganti import appScreenshot dengan path foto aplikasimu
            </p>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        background: '#0f2d20',
      }}>
        {[
          { num: '100%', label: 'Anti-contek' },
          { num: '<1 detik', label: 'Waktu muat' },
          { num: '4+ jenis', label: 'Perangkat' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '20px 16px', textAlign: 'center',
            borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#7dd3b0', lineHeight: 1 }}>{s.num}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Features ── */}
      <section style={{ padding: '40px 24px', background: '#fff' }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#1d9e75', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Kenapa AONE Smart CBT?</p>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0a2e22', marginBottom: 4, letterSpacing: '-0.3px' }}>Dirancang untuk kemudahan guru</h2>
        <p style={{ fontSize: 13, color: '#5a7a6a', marginBottom: 24 }}>Fitur lengkap tanpa kerumitan teknis</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              background: '#f0faf5',
              border: '1px solid rgba(29,158,117,0.15)',
              borderRadius: 16, padding: '18px 20px',
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{f.icon}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0a2e22', margin: '0 0 4px' }}>{f.title}</p>
                <p style={{ fontSize: 12, color: '#4a7a6a', margin: 0, lineHeight: 1.55 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '32px 24px', background: '#f0faf5', borderTop: '1px solid rgba(29,158,117,0.1)' }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#1d9e75', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Cara kerja</p>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0a2e22', marginBottom: 24, letterSpacing: '-0.3px' }}>3 langkah mulai ujian</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {STEPS.map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#1d9e75', color: '#fff',
                fontSize: 14, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>{s.n}</div>
              <div style={{ paddingTop: 4 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#0a2e22', margin: '0 0 3px' }}>{s.title}</p>
                <p style={{ fontSize: 12, color: '#4a7a6a', margin: 0, lineHeight: 1.55 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Developer card ── */}
      <section style={{ padding: '32px 24px', background: '#fff', borderTop: '1px solid rgba(29,158,117,0.1)' }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#1d9e75', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Pengembang</p>
        <div style={{
          background: 'linear-gradient(135deg, #0a2e22, #1d4a2e)',
          borderRadius: 20, padding: '24px 24px',
          display: 'flex', alignItems: 'center', gap: 18,
          flexWrap: 'wrap',
        }}>
          <img src={foto} alt="Irwan Nurdian S.Pd" style={{
            width: 72, height: 72, borderRadius: '50%',
            objectFit: 'cover', objectPosition: 'center top',
            border: '3px solid rgba(125,211,176,0.4)',
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#e1f5ee', margin: '0 0 4px' }}>Irwan Nurdian, S.Pd</p>
            <p style={{ fontSize: 12, color: 'rgba(225,245,238,0.65)', margin: '0 0 12px' }}>Pengembang Aplikasi · Guru MIN 2 Sarolangun</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(125,211,176,0.15)', color: '#7dd3b0', padding: '4px 12px', borderRadius: 20 }}>MIN 2 Sarolangun</span>
              <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(125,211,176,0.15)', color: '#7dd3b0', padding: '4px 12px', borderRadius: 20 }}>Jambi · 2026</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ padding: '36px 24px 48px', background: '#f0faf5', textAlign: 'center', borderTop: '1px solid rgba(29,158,117,0.1)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0a2e22', margin: '0 0 8px', letterSpacing: '-0.3px' }}>Siap memulai ujian digital?</h2>
        <p style={{ fontSize: 13, color: '#4a7a6a', margin: '0 0 24px' }}>Masuk ke portal guru dan kelola ujian dengan mudah</p>
        <button onClick={handleEnter} style={{
          padding: '14px 36px', borderRadius: 14, border: 'none',
          background: '#1d9e75', color: '#fff',
          fontSize: 15, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(29,158,117,0.3)',
          transition: 'transform 0.15s, box-shadow 0.15s',
          letterSpacing: '0.02em',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 14px 32px rgba(29,158,117,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(29,158,117,0.3)'; }}
        >
          MASUK KE PORTAL GURU →
        </button>
        <p style={{ fontSize: 11, color: '#8aaa9a', marginTop: 20, marginBottom: 0 }}>
          © 2026 AONE Smart CBT · MIN 2 Sarolangun
        </p>
      </section>

    </div>
  );
}

/* ══════════════════════════════════════
   LOGIN FORM
══════════════════════════════════════ */
function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [visible,  setVisible]  = useState(false);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: teacher, error: err } = await supabase
        .from('teachers').select('*')
        .eq('username', username.trim().toLowerCase())
        .eq('password', password).eq('is_active', true).single();

      if (err || !teacher) { setError('Username atau password salah.'); return; }

      const today = new Date().toISOString().split('T')[0];
      const { data: tugasHariIni } = await supabase
        .from('tugas_mengawas')
        .select(`id, nama_ruang, token_pengawas, is_active, jadwal_ujian ( id, tanggal, waktu_mulai, durasi, status, tokens, paket_soal(mapel) )`)
        .eq('teacher_id', teacher.id).eq('is_active', true);

      const tugasToday = (tugasHariIni || []).filter(t => t.jadwal_ujian?.tanggal === today);
      const session = { ...teacher, tugasHariIni: tugasToday };
      localStorage.setItem('guru_session', JSON.stringify(session));
      onLogin(session);
    } catch { setError('Terjadi kesalahan koneksi.'); }
    finally { setLoading(false); }
  };

  const iBase = {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    border: '1.5px solid #d1e8df', fontSize: 14, fontFamily: 'inherit',
    fontWeight: 500, color: '#1e293b', background: '#f0faf5',
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
  };
  const onFocus = e => { e.target.style.borderColor='#1d9e75'; e.target.style.background='#fff'; e.target.style.boxShadow='0 0 0 3px rgba(29,158,117,0.12)'; };
  const onBlur  = e => { e.target.style.borderColor='#d1e8df'; e.target.style.background='#f0faf5'; e.target.style.boxShadow='none'; };

  return (
    <div style={{
      ...S.page, ...S.fadeIn(visible),
      background: 'linear-gradient(170deg, #e8f5ef 0%, #d4eee4 50%, #e0f0f8 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      {/* Orbs */}
      <div style={{ position:'absolute', top:-80, right:-80, width:300, height:300, borderRadius:'50%', background:'rgba(29,158,117,0.08)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-60, left:-60, width:220, height:220, borderRadius:'50%', background:'rgba(56,139,253,0.07)', pointerEvents:'none' }} />

      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{
          background: '#fff', borderRadius: 28,
          boxShadow: '0 8px 48px rgba(10,46,34,0.10)',
          border: '1px solid rgba(29,158,117,0.15)',
          overflow: 'hidden',
        }}>
          {/* Top strip */}
          <div style={{ height: 4, background: 'linear-gradient(90deg, #1d9e75, #38b2ac, #3b82f6)' }} />

          <div style={{ padding: '32px 36px 28px' }}>
            {/* Logo + title */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <img src={logo} alt="AONE Smart CBT" style={{
                height: 70, objectFit: 'contain', marginBottom: 14,
                filter: 'drop-shadow(0 4px 10px rgba(29,158,117,0.2))',
              }} />
              <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0a2e22', margin: '0 0 4px', letterSpacing: '-0.3px' }}>
                Portal Guru
              </h1>
              <p style={{ fontSize: 12, color: '#5a7a6a', margin: 0 }}>
                AONE Smart CBT · MIN 2 Sarolangun
              </p>
            </div>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Username */}
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#5a7a6a', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="username.guru" required autoComplete="username"
                  style={iBase} onFocus={onFocus} onBlur={onBlur} />
              </div>

              {/* Password */}
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#5a7a6a', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required autoComplete="current-password"
                    style={{ ...iBase, paddingRight: 44 }} onFocus={onFocus} onBlur={onBlur} />
                  <button type="button" onClick={() => setShowPass(p => !p)} style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: '#94a3b8', display: 'flex', alignItems: 'center',
                  }}
                    onMouseEnter={e => e.currentTarget.style.color='#1d9e75'}
                    onMouseLeave={e => e.currentTarget.style.color='#94a3b8'}
                  >
                    {showPass
                      ? <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21"/></svg>
                      : <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    }
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:12, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', fontSize:13, fontWeight:500 }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink:0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                background: loading ? '#7dd3b0' : '#1d9e75',
                color: '#fff', fontSize: 14, fontWeight: 800, letterSpacing: '0.06em',
                textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 6px 20px rgba(29,158,117,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'transform 0.15s, box-shadow 0.15s, background 0.15s', marginTop: 4,
              }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.background='#0f6e56'; e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 10px 28px rgba(29,158,117,0.4)'; }}}
                onMouseLeave={e => { e.currentTarget.style.background=loading?'#7dd3b0':'#1d9e75'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow=loading?'none':'0 6px 20px rgba(29,158,117,0.3)'; }}
              >
                {loading
                  ? <><svg width="15" height="15" fill="none" viewBox="0 0 24 24" style={{ animation:'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4"/><path fill="white" d="M4 12a8 8 0 018-8v8H4z"/></svg> Memverifikasi...</>
                  : 'Masuk'
                }
              </button>
            </form>
          </div>

          {/* Footer dev card */}
          <div style={{ borderTop: '1px solid #e8f5ef', padding: '12px 36px', display: 'flex', alignItems: 'center', gap: 12, background: '#f8fdfb' }}>
            <img src={foto} alt="Irwan Nurdian S.Pd" style={{
              width: 36, height: 36, borderRadius: '50%',
              objectFit: 'cover', objectPosition: 'center top',
              border: '2px solid rgba(29,158,117,0.3)', flexShrink: 0,
            }} />
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#1a3a2a', margin: 0 }}>Irwan Nurdian, S.Pd</p>
              <p style={{ fontSize: 10, color: '#5a7a6a', margin: 0 }}>Pengembang · MIN 2 Sarolangun</p>
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 10, color: '#8aaa9a', marginTop: 14 }}>
          © 2026 AONE Smart CBT · MIN 2 Sarolangun
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── Root Export ── */
export default function TeacherLogin({ onLogin }) {
  const [screen, setScreen] = useState('welcome');
  return screen === 'welcome'
    ? <WelcomeScreen onEnter={() => setScreen('login')} />
    : <LoginForm onLogin={onLogin} />;
}