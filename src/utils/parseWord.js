/**
 * Parse file .docx soal dengan format tabel:
 * | nomor | teks soal |
 * |       | A | pilihan A |
 * |       | B | pilihan B |
 * |       | C | pilihan C |
 * |       | D | pilihan D |
 * |       | kunci (A/B/C/D) | |
 */
export async function parseWordSoal(file) {
  try {
    // Gunakan mammoth via CDN atau import jika tersedia
    // Fallback: parse XML langsung dari DOCX (zip)
    const arrayBuffer = await file.arrayBuffer();

    // Coba dynamic import mammoth jika ada
    let mammoth;
    try {
      mammoth = await import('mammoth');
    } catch {
      // mammoth tidak tersedia, parse manual
      return await parseDocxManual(arrayBuffer);
    }

    const result = await mammoth.convertToHtml({ arrayBuffer });
    return parseFromHtml(result.value);
  } catch (e) {
    throw new Error('Gagal membaca file: ' + e.message);
  }
}

function parseFromHtml(html) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');
  const tables = doc.querySelectorAll('table');
  const soals  = [];

  tables.forEach(table => {
    const rows  = Array.from(table.querySelectorAll('tr'));
    let current = null;

    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td,th')).map(c => c.textContent.trim());
      if (cells.length < 2) return;

      const col0 = cells[0]?.trim();
      const col1 = cells[1]?.trim();
      const col2 = cells[2]?.trim() || '';

      // Baris soal: kolom pertama adalah nomor (angka)
      if (/^\d+$/.test(col0) && col1) {
        if (current) soals.push(current);
        current = { nomor: parseInt(col0), soal: col1, a:'', b:'', c:'', d:'', kunci:'' };
        return;
      }

      if (!current) return;

      // Baris pilihan: kolom 0 kosong, kolom 1 = A/B/C/D
      const opt = col1?.toUpperCase();
      if (!col0 && ['A','B','C','D'].includes(opt)) {
        current[opt.toLowerCase()] = col2;
        return;
      }

      // Baris kunci: kolom 0 kosong, kolom 1 = A/B/C/D (tanpa kolom 2 atau kolom 2 kosong)
      if (!col0 && ['A','B','C','D'].includes(opt) && !col2) {
        current.kunci = opt;
        return;
      }
      // Format alternatif: kolom 0 kosong, kolom 1 kosong, kolom 2 = kunci
      if (!col0 && !col1 && ['A','B','C','D'].includes(col2?.toUpperCase())) {
        current.kunci = col2.toUpperCase();
        return;
      }
    });

    if (current) soals.push(current);
  });

  // Normalize ke format content_json
  return soals
    .filter(s => s.soal && s.kunci)
    .map(s => ({
      nomor: s.nomor,
      soal: s.soal,
      pilihan_a: s.a || s.A || '',
      pilihan_b: s.b || s.B || '',
      pilihan_c: s.c || s.C || '',
      pilihan_d: s.d || s.D || '',
      kunci: s.kunci,
    }));
}

// Parse manual jika mammoth tidak tersedia
async function parseDocxManual(arrayBuffer) {
  try {
    const JSZip = (await import('jszip')).default;
    const zip   = await JSZip.loadAsync(arrayBuffer);
    const xml   = await zip.file('word/document.xml')?.async('text');
    if (!xml) throw new Error('Format file tidak valid');

    // Parse XML tabel
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'application/xml');
    const tables = xmlDoc.querySelectorAll('tbl');
    const soals  = [];

    tables.forEach(table => {
      const rows   = Array.from(table.querySelectorAll('tr'));
      let current  = null;
      let rowIndex = 0;

      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('tc')).map(tc =>
          Array.from(tc.querySelectorAll('t')).map(t => t.textContent).join('').trim()
        );

        if (cells.length < 2) return;
        const [c0, c1, c2=''] = cells;

        if (/^\d+$/.test(c0) && c1) {
          if (current) soals.push(current);
          current = { nomor: parseInt(c0), soal: c1, a:'', b:'', c:'', d:'', kunci:'' };
          return;
        }
        if (!current) return;

        const opt = c1?.toUpperCase();
        if (!c0 && ['A','B','C','D'].includes(opt)) {
          if (c2) current[opt.toLowerCase()] = c2;
          else current.kunci = opt;
          return;
        }
        if (!c0 && !c1 && ['A','B','C','D'].includes(c2?.toUpperCase())) {
          current.kunci = c2.toUpperCase();
        }
      });

      if (current) soals.push(current);
    });

    return soals.filter(s => s.soal && s.kunci).map(s => ({
      nomor: s.nomor,
      soal: s.soal,
      pilihan_a: s.a,
      pilihan_b: s.b,
      pilihan_c: s.c,
      pilihan_d: s.d,
      kunci: s.kunci,
    }));
  } catch (e) {
    throw new Error('Gagal parse dokumen: ' + e.message);
  }
}