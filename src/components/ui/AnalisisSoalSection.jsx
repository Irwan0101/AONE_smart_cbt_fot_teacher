import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, BarChart2, Users,
  AlertCircle, FileSpreadsheet, BookOpen,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function stripHtml(html = '') {
  return html
    .replace(/<img[^>]*>/gi, '[Gambar]')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function diffLabel(pct) {
  if (pct >= 75) return { label: 'Mudah', color: '#16a34a', bg: '#dcfce7' };
  if (pct >= 40) return { label: 'Sedang', color: '#b45309', bg: '#fef3c7' };
  return { label: 'Sulit', color: '#dc2626', bg: '#fee2e2' };
}

/**
 * Parse jadwal_mengajar – handles both string and array.
 * Returns array of { mapel, tingkat, kelas[] }
 */
function parseJadwalMengajar(raw) {
  if (!raw) return [];
  try { return Array.isArray(raw) ? raw : JSON.parse(raw); } catch { return []; }
}

/**
 * Build a Set of "fullKelas_mapel" keys from jadwal_mengajar.
 * fullKelas = tingkat + kelas element, e.g. "5C"
 */
function buildJadwalKeySet(jadwalMengajar) {
  const keys = new Set();
  jadwalMengajar.forEach((jm) => {
    const mapel = (jm.mapel || '').toLowerCase();
    const tingkat = jm.tingkat ? String(jm.tingkat) : '';
    const kelasList = Array.isArray(jm.kelas) ? jm.kelas : jm.kelas ? [jm.kelas] : [];
    kelasList.forEach((k) => {
      keys.add(`${tingkat}${k}_${mapel}`);
    });
  });
  return keys;
}

const OPSI_COLORS = {
  A: { solid: '#378ADD', light: '#E6F1FB', text: '#0C447C' },
  B: { solid: '#1D9E75', light: '#E1F5EE', text: '#085041' },
  C: { solid: '#BA7517', light: '#FAEEDA', text: '#633806' },
  D: { solid: '#534AB7', light: '#EEEDFE', text: '#3C3489' },
};

// ─────────────────────────────────────────────
// Export Excel
// ─────────────────────────────────────────────

function csCell(bgRgb, fontRgb, bold = false, halign = 'center') {
  return {
    fill: { patternType: 'solid', fgColor: { rgb: bgRgb } },
    font: { color: { rgb: fontRgb }, bold, sz: 10 },
    alignment: { horizontal: halign, vertical: 'center', wrapText: false },
    border: {
      top:    { style: 'thin', color: { rgb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
      left:   { style: 'thin', color: { rgb: 'D1D5DB' } },
      right:  { style: 'thin', color: { rgb: 'D1D5DB' } },
    },
  };
}

function csJawab(benar) {
  const rgb = benar
    ? { bg: 'C6EFCE', font: '276221', border: 'A3D9A5' }
    : { bg: 'FFC7CE', font: '9C0006', border: 'F5A5A5' };
  return {
    fill: { patternType: 'solid', fgColor: { rgb: rgb.bg } },
    font: { color: { rgb: rgb.font }, bold: true, sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top:    { style: 'thin', color: { rgb: rgb.border } },
      bottom: { style: 'thin', color: { rgb: rgb.border } },
      left:   { style: 'thin', color: { rgb: rgb.border } },
      right:  { style: 'thin', color: { rgb: rgb.border } },
    },
  };
}

function exportAnalisisExcel(mapelGroups) {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set();

  mapelGroups.forEach(({ mapel, kelas, tanggal, soalList, siswaRows = [] }) => {
    const nSoal = soalList.length;
    const nomor = soalList.map((s) => s.no);
    const kunciArr = soalList.map((s) => s.kunci);
    const kunciByNo = Object.fromEntries(soalList.map((s) => [String(s.no), s.kunci]));

    const judulStr = `${mapel}${kelas ? ' – Kelas ' + kelas : ''}${tanggal ? '  (' + new Date(tanggal).toLocaleDateString('id-ID') + ')' : ''}`;
    const headerRow = ['No', 'NISN', 'Nama Siswa', 'Kelas', 'Nilai', '✓ Benar', '✗ Salah', ...nomor];
    const kunciRow  = ['', '', 'KUNCI JAWABAN', '', '', '', '', ...kunciArr];

    const dataRows = siswaRows.map((siswa, idx) => {
      let jawaban = {};
      try {
        jawaban = typeof siswa.jawaban_user === 'string'
          ? JSON.parse(siswa.jawaban_user) : siswa.jawaban_user || {};
      } catch {}
      let benar = 0, salah = 0;
      nomor.forEach((no) => {
        const jwb = (jawaban[String(no)] || '').toUpperCase();
        if (!jwb) return;
        jwb === kunciByNo[String(no)] ? benar++ : salah++;
      });
      return [
        idx + 1, siswa.nisn || '', siswa.nama || '', siswa.kelas || '',
        siswa.nilai ?? '', benar, salah,
        ...nomor.map((no) => (jawaban[String(no)] || '').toUpperCase()),
      ];
    });

    const statBenar = ['', '', '∑ Benar per Soal', '', '', '', '', ...soalList.map((s) => s.jumlahBenar)];
    const statPct   = ['', '', '% Benar per Soal', '', '', '', '',
      ...soalList.map((s) => s.totalSiswa > 0 ? Math.round((s.jumlahBenar / s.totalSiswa) * 100) + '%' : '0%')];

    const wsData = [
      [judulStr],
      headerRow,
      kunciRow,
      ...dataRows,
      statBenar,
      statPct,
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const totalCols = headerRow.length;

    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }];

    const aJudul = XLSX.utils.encode_cell({ r: 0, c: 0 });
    if (!ws[aJudul]) ws[aJudul] = { v: judulStr, t: 's' };
    ws[aJudul].s = {
      fill: { patternType: 'solid', fgColor: { rgb: '1F3864' } },
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 12 },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    for (let c = 0; c < totalCols; c++) {
      const a = XLSX.utils.encode_cell({ r: 1, c });
      if (!ws[a]) ws[a] = { v: headerRow[c], t: 's' };
      ws[a].s = csCell('2E4057', 'FFFFFF', true, 'center');
    }

    for (let c = 0; c < totalCols; c++) {
      const a = XLSX.utils.encode_cell({ r: 2, c });
      if (!ws[a]) ws[a] = { v: kunciRow[c] ?? '', t: 's' };
      ws[a].s = csCell('FFE699', '7B5B00', true, 'center');
    }

    for (let r = 3; r < 3 + dataRows.length; r++) {
      const isGanjil = (r - 3) % 2 === 0;
      const rowBg = isGanjil ? 'FFFFFF' : 'F8FAFC';
      for (let c = 0; c < 7; c++) {
        const a = XLSX.utils.encode_cell({ r, c });
        if (!ws[a]) ws[a] = { v: wsData[r][c] ?? '', t: 's' };
        const val = wsData[r][c];
        let bg = rowBg;
        if (c === 4 && typeof val === 'number') {
          bg = val >= 80 ? 'D1FAE5' : val >= 70 ? 'DBEAFE' : val >= 60 ? 'FEF3C7' : 'FEE2E2';
        }
        if (c === 5) bg = 'F0FDF4';
        if (c === 6) bg = 'FFF1F2';
        ws[a].s = csCell(bg, c === 5 ? '16A34A' : c === 6 ? 'DC2626' : '374151', c >= 4, c !== 2 ? 'center' : 'left');
      }
      for (let ci = 0; ci < nSoal; ci++) {
        const c = 7 + ci;
        const a = XLSX.utils.encode_cell({ r, c });
        const jawaban = wsData[r][c];
        const kunci = kunciArr[ci];
        if (!ws[a]) ws[a] = { v: jawaban ?? '', t: 's' };
        if (jawaban && kunci) {
          ws[a].s = csJawab(jawaban === kunci);
        } else {
          ws[a].s = csCell('F9FAFB', '9CA3AF', false, 'center');
        }
      }
    }

    const rStat1 = 3 + dataRows.length;
    const rStat2 = rStat1 + 1;
    for (let c = 0; c < totalCols; c++) {
      const a1 = XLSX.utils.encode_cell({ r: rStat1, c });
      const a2 = XLSX.utils.encode_cell({ r: rStat2, c });
      if (!ws[a1]) ws[a1] = { v: wsData[rStat1]?.[c] ?? '', t: 's' };
      if (!ws[a2]) ws[a2] = { v: wsData[rStat2]?.[c] ?? '', t: 's' };
      ws[a1].s = csCell(c < 7 ? 'EEF2FF' : 'DBEAFE', '1E40AF', true, 'center');
      ws[a2].s = csCell(c < 7 ? 'F5F3FF' : 'EDE9FE', '5B21B6', true, 'center');
    }

    ws['!rows'] = [
      { hpx: 26 }, { hpx: 20 }, { hpx: 18 },
      ...Array(dataRows.length).fill({ hpx: 17 }),
      { hpx: 18 }, { hpx: 18 },
    ];
    ws['!cols'] = [
      { wch: 4 }, { wch: 14 }, { wch: 26 }, { wch: 6 },
      { wch: 7 }, { wch: 8 }, { wch: 8 },
      ...Array(nSoal).fill({ wch: 4 }),
    ];

    const kelasTag = kelas ? `_${kelas}` : '';
    let base = `${mapel}${kelasTag}`.replace(/[\\/:*?[\]]/g, '').slice(0, 28);
    let name = base; let ct = 2;
    while (usedNames.has(name)) { name = `${base.slice(0, 25)}_${ct++}`; }
    usedNames.add(name);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  // Ringkasan
  const summaryHeader = ['Mata Pelajaran', 'Kelas', 'Tanggal', 'Jml Soal', 'Jml Siswa', 'Rata-rata', 'Mudah', 'Sedang', 'Sulit'];
  const summaryRows = mapelGroups.map(({ mapel, kelas, tanggal, soalList, siswaRows }) => {
    const pctArr = soalList.map((s) => s.totalSiswa > 0 ? (s.jumlahBenar / s.totalSiswa) * 100 : 0);
    const rataVal = siswaRows.length
      ? Math.round(siswaRows.reduce((a, r) => a + (Number(r.nilai) || 0), 0) / siswaRows.length) : 0;
    return [
      mapel, kelas || '-',
      tanggal ? new Date(tanggal).toLocaleDateString('id-ID') : '-',
      soalList.length, siswaRows.length, rataVal,
      pctArr.filter((p) => p >= 75).length,
      pctArr.filter((p) => p >= 40 && p < 75).length,
      pctArr.filter((p) => p < 40).length,
    ];
  });

  const wsSummary = XLSX.utils.aoa_to_sheet([
    ['ANALISIS JAWABAN UJIAN'],
    ['Dicetak:', new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })],
    [],
    summaryHeader,
    ...summaryRows,
  ]);
  wsSummary['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: summaryHeader.length - 1 } }];
  const aT = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (wsSummary[aT]) wsSummary[aT].s = { fill: { patternType: 'solid', fgColor: { rgb: '1F3864' } }, font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 13 }, alignment: { horizontal: 'center', vertical: 'center' } };
  for (let c = 0; c < summaryHeader.length; c++) {
    const a = XLSX.utils.encode_cell({ r: 3, c });
    if (wsSummary[a]) wsSummary[a].s = csCell('2E4057', 'FFFFFF', true, 'center');
  }
  wsSummary['!cols'] = [{ wch: 26 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];
  wsSummary['!rows'] = [{ hpx: 26 }, { hpx: 14 }, { hpx: 6 }, { hpx: 20 }];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');
  wb.SheetNames = ['Ringkasan', ...wb.SheetNames.filter((n) => n !== 'Ringkasan')];

  XLSX.writeFile(wb, `Analisis_Jawaban_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─────────────────────────────────────────────
// Build helpers
// ─────────────────────────────────────────────

function buildSoalList(soalRaw, hasilArr, siswaMap) {
  return soalRaw.map((soal) => {
    const noStr = String(soal.no);
    const kunci = (soal.kunci || '').toUpperCase().trim();
    const dist = {
      A: { jumlah: 0, siswa: [] }, B: { jumlah: 0, siswa: [] },
      C: { jumlah: 0, siswa: [] }, D: { jumlah: 0, siswa: [] },
    };
    const tidakMenjawab = [];
    hasilArr.forEach((hasil) => {
      const nama = siswaMap[hasil.user_id]?.name || 'Siswa';
      let jawaban = {};
      try { jawaban = typeof hasil.jawaban_user === 'string' ? JSON.parse(hasil.jawaban_user) : hasil.jawaban_user || {}; } catch {}
      const pilihan = (jawaban[noStr] || '').toUpperCase().trim();
      if (pilihan && dist[pilihan]) { dist[pilihan].jumlah++; dist[pilihan].siswa.push(nama); }
      else { tidakMenjawab.push(nama); }
    });
    return {
      no: Number(soal.no), soalHtml: soal.soal || '', kunci,
      opsi: {
        A: { html: soal.a || '', jumlah: dist.A.jumlah, siswa: dist.A.siswa },
        B: { html: soal.b || '', jumlah: dist.B.jumlah, siswa: dist.B.siswa },
        C: { html: soal.c || '', jumlah: dist.C.jumlah, siswa: dist.C.siswa },
        D: { html: soal.d || '', jumlah: dist.D.jumlah, siswa: dist.D.siswa },
      },
      tidakMenjawab,
      totalSiswa: hasilArr.length,
      jumlahBenar: dist[kunci]?.jumlah ?? 0,
    };
  });
}

function buildSiswaRows(hasilArr, siswaMap) {
  return hasilArr.map((hasil) => {
    const info = siswaMap[hasil.user_id] || {};
    return {
      nisn: info.nisn || '',
      nama: info.name || '',
      kelas: info.class || '',
      nilai: hasil.skor ?? '',
      jawaban_user: hasil.jawaban_user,
    };
  });
}

// ─────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────

function JawabanCell({ jawaban, kunci }) {
  const benar = jawaban && kunci && jawaban === kunci;
  return (
    <td className={`text-center text-[11px] font-bold border-r border-gray-200 dark:border-gray-700 w-8 min-w-[2rem] py-1.5
      ${!jawaban ? 'text-gray-300 dark:text-gray-600' :
        benar    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' :
                   'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'}`}>
      {jawaban || '–'}
    </td>
  );
}

function SoalHeaderCell({ soal }) {
  const pct = soal.totalSiswa > 0 ? Math.round((soal.jumlahBenar / soal.totalSiswa) * 100) : 0;
  const diff = diffLabel(pct);
  return (
    <th className="border-r border-gray-600 w-8 min-w-[2rem] relative group cursor-default">
      <div className="flex flex-col items-center gap-0.5 py-1 px-0.5">
        <span className="text-[10px] font-bold text-gray-200">{soal.no}</span>
        <span className="text-[8px] font-bold px-0.5 rounded leading-tight"
          style={{ background: diff.bg, color: diff.color }}>
          {pct}%
        </span>
      </div>
      {/* Tooltip */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 z-30 hidden group-hover:flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-xl p-3 w-56 text-left gap-2 mt-1 pointer-events-none">
        <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 line-clamp-3 leading-relaxed">
          {stripHtml(soal.soalHtml) || `Soal nomor ${soal.no}`}
        </p>
        <div className="border-t border-gray-100 dark:border-gray-700 pt-2 space-y-1">
          {['A', 'B', 'C', 'D'].map((k) => {
            const op = soal.opsi[k]; if (!op) return null;
            const isKunci = k === soal.kunci;
            const st = OPSI_COLORS[k];
            const barPct = soal.totalSiswa > 0 ? Math.round(op.jumlah / soal.totalSiswa * 100) : 0;
            return (
              <div key={k} className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold w-4 h-4 rounded flex items-center justify-center shrink-0"
                  style={{ background: isKunci ? st.solid : st.light, color: isKunci ? '#fff' : st.text }}>
                  {k}
                </span>
                <div className="flex-1 h-1.5 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${barPct}%`, background: isKunci ? st.solid : '#CBD5E1' }} />
                </div>
                <span className="text-[9px] text-gray-500 w-5 text-right shrink-0">{op.jumlah}</span>
              </div>
            );
          })}
        </div>
      </div>
    </th>
  );
}

function MapelPanel({ group, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const { mapel, kelas, tanggal, soalList, siswaRows, totalSiswa } = group;

  const soalSulit  = soalList.filter((s) => s.totalSiswa > 0 && (s.jumlahBenar / s.totalSiswa) * 100 < 40).length;
  const soalMudah  = soalList.filter((s) => s.totalSiswa > 0 && (s.jumlahBenar / s.totalSiswa) * 100 >= 75).length;
  const soalSedang = soalList.length - soalMudah - soalSulit;
  const rataBenar  = soalList.length
    ? Math.round(soalList.reduce((a, s) => a + (s.totalSiswa > 0 ? (s.jumlahBenar / s.totalSiswa) * 100 : 0), 0) / soalList.length)
    : 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors text-left">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
          <BookOpen size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900 dark:text-white">{mapel}</span>
            {kelas && (
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
                Kelas {kelas}
              </span>
            )}
            {tanggal && (
              <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                {new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-[11px] text-gray-400">{soalList.length} soal · {totalSiswa} siswa</span>
            <span className="text-[11px] font-semibold text-indigo-500">{rataBenar}% rata benar</span>
            {soalSulit > 0 && (
              <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full">
                {soalSulit} soal sulit
              </span>
            )}
          </div>
        </div>
        <div className="hidden md:flex gap-2 shrink-0">
          {[
            { label: 'Mudah',  val: soalMudah,  bg: '#dcfce7', color: '#16a34a' },
            { label: 'Sedang', val: soalSedang, bg: '#fef3c7', color: '#b45309' },
            { label: 'Sulit',  val: soalSulit,  bg: '#fee2e2', color: '#dc2626' },
          ].map(({ label, val, bg, color }) => (
            <div key={label} className="text-center px-3 py-1.5 rounded-xl" style={{ background: bg }}>
              <div className="text-sm font-extrabold" style={{ color }}>{val}</div>
              <div className="text-[9px] font-semibold text-gray-500">{label}</div>
            </div>
          ))}
        </div>
        <ChevronDown size={15} className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-gray-100 dark:border-gray-800"
          >
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs w-full">
                <thead>
                  <tr className="bg-[#1F3864]">
                    <th className="sticky left-0 z-10 bg-[#1F3864] text-white text-[10px] font-bold px-2 py-2 border-r border-[#2E4A7A] text-center w-8 min-w-[2rem]">No</th>
                    <th className="sticky left-8 z-10 bg-[#1F3864] text-white text-[10px] font-bold px-3 py-2 border-r border-[#2E4A7A] text-left min-w-[160px]">Nama Siswa</th>
                    <th className="text-white text-[10px] font-bold px-2 py-2 border-r border-[#2E4A7A] text-center w-12">Kelas</th>
                    <th className="text-white text-[10px] font-bold px-2 py-2 border-r border-[#2E4A7A] text-center w-14">Nilai</th>
                    <th className="text-white text-[10px] font-bold px-2 py-2 border-r border-[#2E4A7A] text-center w-12" style={{ background: '#166534' }}>✓ Benar</th>
                    <th className="text-white text-[10px] font-bold px-2 py-2 border-r border-[#2E4A7A] text-center w-12" style={{ background: '#991B1B' }}>✗ Salah</th>
                    {soalList.map((s) => <SoalHeaderCell key={s.no} soal={s} />)}
                  </tr>
                  <tr className="bg-amber-50 dark:bg-amber-950/30">
                    <td className="sticky left-0 z-10 bg-amber-50 dark:bg-amber-950/30 border-r border-amber-200 dark:border-amber-700 py-1.5 text-center text-amber-600 font-bold text-[10px]">🔑</td>
                    <td className="sticky left-8 z-10 bg-amber-50 dark:bg-amber-950/30 border-r border-amber-200 dark:border-amber-700 px-3 py-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      Kunci Jawaban
                    </td>
                    <td className="border-r border-amber-200 dark:border-amber-700" />
                    <td className="border-r border-amber-200 dark:border-amber-700" />
                    <td className="border-r border-amber-200 dark:border-amber-700" />
                    <td className="border-r border-amber-200 dark:border-amber-700" />
                    {soalList.map((s) => (
                      <td key={s.no} className="text-center text-[11px] font-extrabold border-r border-amber-200 dark:border-amber-700 py-1.5 w-8"
                        style={{ color: OPSI_COLORS[s.kunci]?.solid || '#374151' }}>
                        {s.kunci}
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {siswaRows.map((siswa, idx) => {
                    let jawaban = {};
                    try {
                      jawaban = typeof siswa.jawaban_user === 'string'
                        ? JSON.parse(siswa.jawaban_user) : siswa.jawaban_user || {};
                    } catch {}
                    let benar = 0, salah = 0;
                    soalList.forEach((s) => {
                      const jwb = (jawaban[String(s.no)] || '').toUpperCase();
                      if (!jwb) return;
                      jwb === s.kunci ? benar++ : salah++;
                    });
                    const isGanjil = idx % 2 === 0;
                    const rowCls = isGanjil ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/70 dark:bg-gray-800/30';
                    return (
                      <tr key={idx} className={rowCls}>
                        <td className={`sticky left-0 z-10 ${rowCls} text-center text-gray-400 font-mono border-r border-gray-200 dark:border-gray-700 px-1 py-1.5 text-[10px]`}>
                          {idx + 1}
                        </td>
                        <td className={`sticky left-8 z-10 ${rowCls} px-3 py-1.5 border-r border-gray-200 dark:border-gray-700 font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap`}>
                          {siswa.nama}
                        </td>
                        <td className="text-center text-gray-500 border-r border-gray-200 dark:border-gray-700 px-1 py-1.5">{siswa.kelas}</td>
                        <td className="text-center border-r border-gray-200 dark:border-gray-700 px-1 py-1.5">
                          {siswa.nilai !== '' ? (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold
                              ${Number(siswa.nilai) >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
                                Number(siswa.nilai) >= 70 ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' :
                                Number(siswa.nilai) >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' :
                                'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
                              {siswa.nilai}
                            </span>
                          ) : <span className="text-gray-300 dark:text-gray-600">–</span>}
                        </td>
                        <td className="text-center font-bold text-emerald-600 dark:text-emerald-400 border-r border-gray-200 dark:border-gray-700 px-1 py-1.5 bg-emerald-50/40 dark:bg-emerald-950/10">
                          {benar}
                        </td>
                        <td className="text-center font-bold text-red-500 border-r border-gray-200 dark:border-gray-700 px-1 py-1.5 bg-red-50/40 dark:bg-red-950/10">
                          {salah}
                        </td>
                        {soalList.map((s) => (
                          <JawabanCell
                            key={s.no}
                            jawaban={(jawaban[String(s.no)] || '').toUpperCase()}
                            kunci={s.kunci}
                          />
                        ))}
                      </tr>
                    );
                  })}

                  <tr className="bg-blue-50 dark:bg-blue-950/30 border-t-2 border-blue-200 dark:border-blue-800">
                    <td className="sticky left-0 z-10 bg-blue-50 dark:bg-blue-950/30 border-r border-blue-200 dark:border-blue-800" />
                    <td className="sticky left-8 z-10 bg-blue-50 dark:bg-blue-950/30 px-3 py-1.5 text-[10px] font-bold text-blue-700 dark:text-blue-400 border-r border-blue-200 dark:border-blue-800 whitespace-nowrap">
                      ∑ Benar per Soal
                    </td>
                    <td className="border-r border-blue-200 dark:border-blue-800" />
                    <td className="border-r border-blue-200 dark:border-blue-800" />
                    <td className="border-r border-blue-200 dark:border-blue-800" />
                    <td className="border-r border-blue-200 dark:border-blue-800" />
                    {soalList.map((s) => (
                      <td key={s.no} className="text-center text-[10px] font-bold text-blue-700 dark:text-blue-400 border-r border-blue-200 dark:border-blue-800 py-1.5">
                        {s.jumlahBenar}
                      </td>
                    ))}
                  </tr>

                  <tr className="bg-violet-50 dark:bg-violet-950/30">
                    <td className="sticky left-0 z-10 bg-violet-50 dark:bg-violet-950/30 border-r border-violet-200 dark:border-violet-800" />
                    <td className="sticky left-8 z-10 bg-violet-50 dark:bg-violet-950/30 px-3 py-1.5 text-[10px] font-bold text-violet-700 dark:text-violet-400 border-r border-violet-200 dark:border-violet-800 whitespace-nowrap">
                      % Benar per Soal
                    </td>
                    <td className="border-r border-violet-200 dark:border-violet-800" />
                    <td className="border-r border-violet-200 dark:border-violet-800" />
                    <td className="border-r border-violet-200 dark:border-violet-800" />
                    <td className="border-r border-violet-200 dark:border-violet-800" />
                    {soalList.map((s) => {
                      const pct = s.totalSiswa > 0 ? Math.round((s.jumlahBenar / s.totalSiswa) * 100) : 0;
                      const diff = diffLabel(pct);
                      return (
                        <td key={s.no} className="text-center text-[10px] font-bold border-r border-violet-200 dark:border-violet-800 py-1.5"
                          style={{ color: diff.color }}>
                          {pct}%
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

export default function AnalisisSoalSection({ session }) {
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [mapelGroups, setMapelGroups] = useState([]);
  const [exporting, setExporting]     = useState(false);

  const loadAllAnalisis = useCallback(async () => {
    setLoading(true); setError(''); setMapelGroups([]);
    try {
      const userId = session?.user?.id;
      const role   = session?.user?.role
        || session?.user?.user_metadata?.role
        || session?.role     // ← support flat session dari Report.jsx
        || '';

      // ── Ambil info guru dari tabel teachers (untuk jadwal_mengajar & kelas_wali) ──
      // Gunakan data session langsung jika sudah ada (dikirim dari Report.jsx)
      // supaya konsisten dengan filter di loadGuruMapel / loadWaliKelas.
      const kelasWali = session?.kelas_wali || null;

      // jadwal_mengajar: coba dari session dulu, fallback ke DB
      let jadwalMengajar = parseJadwalMengajar(session?.jadwal_mengajar);
      if (!jadwalMengajar.length && userId) {
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('jadwal_mengajar, kelas_wali')
          .eq('id', userId)
          .single();
        if (teacherData) {
          jadwalMengajar = parseJadwalMengajar(teacherData.jadwal_mengajar);
        }
      }

      // Key set untuk guru_mapel: "5C_bahasa arab"
      const jadwalKeySet = buildJadwalKeySet(jadwalMengajar);

      // Daftar mapel & kelas yang boleh dilihat guru
      const mapelSetGuru = new Set(
        jadwalMengajar.map((jm) => (jm.mapel || '').toLowerCase()).filter(Boolean)
      );
      const kelasSetGuru = new Set(
        jadwalMengajar.flatMap((jm) => {
          const tingkat = jm.tingkat ? String(jm.tingkat) : '';
          const kelasList = Array.isArray(jm.kelas) ? jm.kelas : jm.kelas ? [jm.kelas] : [];
          return kelasList.map((k) => `${tingkat}${k}`);
        }).filter(Boolean)
      );

      // ── 1. Jadwal + paket_soal ──
      const { data: jadwalRows, error: e1 } = await supabase
        .from('jadwal_ujian')
        .select(`id, paket_id, tanggal, paket_soal ( id, mapel, tingkat, content_json )`)
        .order('tanggal', { ascending: false });
      if (e1) throw new Error('Gagal memuat jadwal: ' + e1.message);

      let validJadwal = (jadwalRows || []).filter((j) => j.paket_id && j.paket_soal?.content_json);

      // ── 2. Filter jadwal per role (konsisten dengan Report.jsx) ──
      if (role === 'guru_mapel') {
        if (!jadwalMengajar.length) {
          setLoading(false);
          return;
        }
        // Hanya tampilkan jadwal yang mapel-nya ada di jadwal_mengajar guru
        validJadwal = validJadwal.filter((j) => {
          const paketMapel = (j.paket_soal?.mapel || '').toLowerCase();
          return mapelSetGuru.has(paketMapel);
        });
      } else if (role === 'wali_kelas') {
        if (kelasWali) {
          // Tingkat wali kelas = angka di depan nama kelas, misal "5C" → tingkat 5
          const tingkatWali = parseInt(kelasWali) || null;
          if (tingkatWali) {
            validJadwal = validJadwal.filter((j) => {
              const t = j.paket_soal?.tingkat ? parseInt(j.paket_soal.tingkat) : null;
              return !t || t === tingkatWali;
            });
          }
        }
      }

      if (!validJadwal.length) { setLoading(false); return; }

      // ── 3. Hasil ujian ──
      const { data: hasilRows, error: e2 } = await supabase
        .from('hasil_ujian')
        .select('user_id, jadwal_id, jawaban_user, skor, waktu_selesai')
        .in('jadwal_id', validJadwal.map((j) => j.id));
      if (e2) throw new Error('Gagal memuat hasil ujian: ' + e2.message);

      // ── 4. Data siswa ──
      const userIds = [...new Set((hasilRows || []).map((r) => r.user_id).filter(Boolean))];
      let siswaMap = {};
      if (userIds.length) {
        const { data: sd } = await supabase
          .from('students')
          .select('id, name, nisn, class')
          .in('id', userIds);
        siswaMap = Object.fromEntries((sd || []).map((s) => [s.id, s]));
      }

      // ── 5. Bangun groups ──
      const groups = [];

      for (const jadwal of validJadwal) {
        const mapel = jadwal.paket_soal?.mapel || `Paket #${jadwal.paket_id}`;
        let soalRaw = [];
        try {
          soalRaw = typeof jadwal.paket_soal.content_json === 'string'
            ? JSON.parse(jadwal.paket_soal.content_json)
            : jadwal.paket_soal.content_json || [];
        } catch {}
        soalRaw.sort((a, b) => Number(a.no) - Number(b.no));

        const hasilJadwal = (hasilRows || []).filter((r) => r.jadwal_id === jadwal.id);

        if (role === 'guru_mapel') {
          // ── GURU MAPEL: breakdown per kelas yang diajar untuk mapel ini ──
          // Gunakan kelasSetGuru yang sudah konsisten dengan Report.jsx
          const kelasDiajar = jadwalMengajar
            .filter((jm) => (jm.mapel || '').toLowerCase() === mapel.toLowerCase())
            .flatMap((jm) => {
              const tingkat = jm.tingkat ? String(jm.tingkat) : '';
              const kelasList = Array.isArray(jm.kelas) ? jm.kelas : jm.kelas ? [jm.kelas] : [];
              return kelasList.map((k) => `${tingkat}${k}`);
            });

          const kelasAda  = new Set(
            hasilJadwal.map((h) => siswaMap[h.user_id]?.class).filter(Boolean)
          );
          // Irisan: kelas yang diajar guru DAN ada hasilnya
          const kelasList = kelasDiajar.length
            ? kelasDiajar.filter((k) => kelasAda.has(k))
            : [...kelasAda];

          for (const kelas of kelasList) {
            // ── FILTER KRITIS: pastikan kelas+mapel ada di jadwalKeySet ──
            const keyCheck = `${kelas}_${mapel.toLowerCase()}`;
            if (jadwalKeySet.size > 0 && !jadwalKeySet.has(keyCheck)) continue;

            const hasilKelas = hasilJadwal.filter(
              (h) => siswaMap[h.user_id]?.class === kelas
            );
            if (!hasilKelas.length) continue;

            groups.push({
              mapel, kelas, tanggal: jadwal.tanggal,
              jadwalId: `${jadwal.id}_${kelas}`,
              soalList:   buildSoalList(soalRaw, hasilKelas, siswaMap),
              siswaRows:  buildSiswaRows(hasilKelas, siswaMap),
              totalSiswa: hasilKelas.length,
            });
          }

        } else {
          // ── WALI KELAS: hanya siswa di kelas_wali ──
          const hasilKelas = kelasWali
            ? hasilJadwal.filter((h) => siswaMap[h.user_id]?.class === kelasWali)
            : hasilJadwal;
          if (!hasilKelas.length) continue;

          groups.push({
            mapel, kelas: kelasWali || null, tanggal: jadwal.tanggal,
            jadwalId: jadwal.id,
            soalList:   buildSoalList(soalRaw, hasilKelas, siswaMap),
            siswaRows:  buildSiswaRows(hasilKelas, siswaMap),
            totalSiswa: hasilKelas.length,
          });
        }
      }

      setMapelGroups(groups.filter((g) => g.totalSiswa > 0));
    } catch (err) {
      console.error('AnalisisSoal error:', err);
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { loadAllAnalisis(); }, [loadAllAnalisis]);

  const handleExport = () => {
    if (!mapelGroups.length) return;
    setExporting(true);
    try { exportAnalisisExcel(mapelGroups); }
    finally { setTimeout(() => setExporting(false), 800); }
  };

  const totalSoal  = mapelGroups.reduce((a, g) => a + g.soalList.length, 0);
  const totalSiswa = mapelGroups.reduce((a, g) => a + g.totalSiswa, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart2 size={16} className="text-indigo-500" />
            Analisis Jawaban per Mapel
          </h3>
          {!loading && mapelGroups.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {mapelGroups.length} ujian · {totalSoal} soal · {totalSiswa} entri siswa
            </p>
          )}
        </div>
        {!loading && mapelGroups.length > 0 && (
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white shadow-md shadow-emerald-500/30 transition-all">
            {exporting
              ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : <FileSpreadsheet size={13} />}
            Export Excel
          </button>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={16} className="shrink-0" />{error}
        </div>
      )}

      {!loading && !error && mapelGroups.length === 0 && (
        <div className="text-center py-14">
          <Users size={34} className="mx-auto text-gray-200 dark:text-gray-700 mb-3" />
          <p className="text-sm text-gray-400 font-semibold">Belum ada data analisis</p>
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Data muncul setelah siswa mengumpulkan jawaban</p>
        </div>
      )}

      {!loading && !error && mapelGroups.length > 0 && (
        <div className="space-y-3">
          {mapelGroups.map((group, i) => (
            <MapelPanel key={group.jadwalId} group={group} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}