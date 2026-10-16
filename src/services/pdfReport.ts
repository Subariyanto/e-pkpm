import jsPDF from 'jspdf';
import type { Assessment, Indicator, Result, Supervisor, Regulasi, PredikatRow, Org } from '../types';
import { calculate, computePriorities, indicatorsForJenjang } from '../services/core';
import { BOBOT_DEFAULT, PREDIKAT_DEFAULT } from '../data/demo';

/** Data organisasi yang dipakai pada kop dan tanda tangan laporan. */
type OrgLike = Partial<Org> & { name: string; chairman?: string; headOffice?: string };

/** Bersihkan teks dari karakter non-Latin (emoji) yang merusak rendering PDF. */
function bersih(v: unknown): string {
  return String(v ?? '').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').replace(/\s+/g, ' ').trim();
}

/** Format tanggal Indonesia, mis. 16 Oktober 2026. */
function tanggalIndo(iso?: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return bersih(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Kop surat resmi empat baris: Kementerian, Kantor Kemenag Kabupaten,
 * alamat, serta telepon dan surel. Baris kosong memakai teks bawaan.
 */
function kopSurat(doc: jsPDF, org: OrgLike): number {
  const kab = bersih(org.district).replace(/^kabupaten\s+/i, '') || 'Jember';
  const alamat = bersih(org.address) || `Jl. Bengawan Solo No. 1, Kabupaten ${kab}`;
  const kontak = [bersih(org.phone), bersih(org.email)].filter(Boolean).join(' / ') || 'Telepon (0331) 000000 / pokjawas@kemenag.go.id';
  let y = 15;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA', 105, y, { align: 'center' }); y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`KANTOR KEMENTERIAN AGAMA KABUPATEN ${kab.toUpperCase()}`, 105, y, { align: 'center' }); y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(alamat, 105, y, { align: 'center' }); y += 4;
  doc.text(kontak, 105, y, { align: 'center' }); y += 4;
  doc.setLineWidth(0.8);
  doc.line(15, y, 195, y);
  doc.setLineWidth(0.2);
  doc.line(15, y + 1.1, 195, y + 1.1);
  return y + 7;
}

/**
 * Judul setiap komponen penilaian beserta bobotnya.
 */
const KOMPONEN_INFO: Record<string, { urut: string; judul: string; bobot: number }> = {
  K1: { urut: 'A.', judul: 'Penyusunan Program', bobot: 10 },
  K2: { urut: 'B.', judul: 'Pelaksanaan Program', bobot: 50 },
  K3: { urut: 'C.', judul: 'Evaluasi Hasil', bobot: 10 },
  K4: { urut: 'D.', judul: 'Pembimbingan dan Pelatihan', bobot: 30 },
};

/** Blok tanda tangan: kiri Ketua Pokjawas, kanan Kepala Kantor.
 *  Posisi mengikuti akhir konten (y0 disuplai pemanggil), bukan hardcoded. */
function tandaTangan(doc: jsPDF, org: OrgLike, kota: string, y0: number) {
  const kiri = 15, kanan = 110;
  const namaKetua = bersih(org.chairman) || '_________________________';
  const namaKantor = bersih(org.headOffice) || '_________________________';
  const nipKetua = bersih((org as any).nipChairman) || '..............................';
  const nipKantor = bersih((org as any).nipHeadOffice) || '..............................';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  // Baris tanggal + jabatan
  doc.text(`${kota}, ${tanggalIndo(new Date().toISOString())}`, kanan, y0);
  doc.text('Mengetahui,', kiri, y0);
  doc.text('Kepala Kantor Kemenag,', kanan, y0 + 5);
  doc.text('Ketua Pokjawas Madrasah,', kiri, y0 + 5);
  // Ruang tanda tangan (3 baris ≈ 12mm)
  doc.setFont('helvetica', 'bold');
  doc.text(namaKantor, kanan, y0 + 20);
  doc.text(namaKetua, kiri, y0 + 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`NIP. ${nipKantor}`, kanan, y0 + 25);
  doc.text(`NIP. ${nipKetua}`, kiri, y0 + 25);
}

function renderIndividual(
  doc: jsPDF,
  supervisor: Supervisor,
  items: Assessment[],
  master: Indicator[],
  result: Result,
  regulasi: Regulasi[],
  org: OrgLike,
  penilai?: string,
) {
  const margin = 15;
  const pageW = 210;
  const innerW = pageW - margin * 2;
  const bobot = BOBOT_DEFAULT;
  const calc = calculate(items, master, undefined, bobot);
  const priorities = computePriorities(items, master, bobot);
  const jenjang = bersih(supervisor.level) || 'Madya';
  const ins = indicatorsForJenjang(master, jenjang);

  // Kop surat resmi
  let y = kopSurat(doc, org as OrgLike);

  // Judul dokumen
  doc.setProperties({
    title: `Laporan PKPM - ${bersih(supervisor.name)}`,
    subject: `Penilaian Kinerja Pengawas Madrasah ${(org as OrgLike).period || '2026'}`,
    author: bersih((org as OrgLike).chairman) || 'Pokjawas Madrasah',
    creator: 'e-PKPM',
  });

  // Judul dokumen
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('LAPORAN HASIL PENILAIAN KINERJA', 105, y, { align: 'center' });
  y += 5.5;
  doc.setFontSize(10);
  doc.text('PENGELOLAAN KINERJA PENGAWAS MADRASAH (PKPM)', 105, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Periode ${(org as OrgLike).period || '2026'} · ${jenjang}`, 105, y, { align: 'center' });
  y += 9;

  // Identity section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setFillColor(23, 63, 112);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, innerW, 7, 'F');
  doc.text('A. Identitas Pengawas', margin + 2, y + 5);
  y += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  const identity = [
    ['Nama', bersih(supervisor.name)],
    ['NIP', bersih(supervisor.nip)],
    ['Pangkat / Golongan', bersih(supervisor.rank) || '-'],
    ['Jenjang Jabatan', jenjang],
    ['Satuan Kerja', bersih(supervisor.workUnit) || '-'],
    ['Wilayah Binaan', bersih(supervisor.region) || '-'],
  ];
  // Kolom nilai dibuat rata kiri pada satu posisi tetap sehingga seluruh
  // titik dua lurus satu garis, sama seperti bagian B dan C.
  const kolonNilai = margin + 48;
  for (const [k, v] of identity) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(k, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(': ' + v, kolonNilai, y);
    y += 5;
  }
  y += 3;

  // Assessor section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setFillColor(23, 63, 112);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, innerW, 7, 'F');
  doc.text('B. Penugasan Penilaian', margin + 2, y + 5);
  y += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const penugasan = [
    ['Nomor SK / Surat Tugas', bersih(result.skPenugasan || result.skNumber) || '-'],
    ['Tanggal SK', tanggalIndo(result.tanggalSk || result.skDate)],
    ['Penilai', bersih(penilai) || '-'],
    ['Mekanisme', bersih(result.mekanismePenilaian || result.mechanism) || 'individual'],
    ['Tanggal Finalisasi', tanggalIndo(result.finalizedAt)],
  ];
  // Sama seperti bagian A: label di kiri, titik dua pada satu kolom tetap.
  const kolonNilai2 = margin + 48;
  for (const [k, v] of penugasan) {
    doc.setFont('helvetica', 'bold');
    doc.text(k, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(': ' + v, kolonNilai2, y);
    y += 5;
  }

  // Dasar Hukum
  // Ditulis lengkap mengikuti menu Regulasi: nomor/judul lengkap, tahun,
  // beserta statusnya; yang sudah dicabut tidak ditampilkan.
  const regulasiUtama = regulasi
    .filter(r => r.status !== 'dicabut')
    .sort((a, b) => (a.urutan ?? a.order ?? 99) - (b.urutan ?? b.order ?? 99));
  if (regulasiUtama.length) {
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setFillColor(23, 63, 112);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, innerW, 7, 'F');
    doc.text('C. Dasar Hukum', margin + 2, y + 5);
    y += 12;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const r of regulasiUtama) {
      const nomor = bersih(r.nomor || r.number);
      const judul = bersih(r.judul || r.tentang || r.title);
      const tahun = r.tahun ? ` (${bersih(r.tahun)})` : '';
      const teks = `${nomor} tentang ${judul}${tahun}`.replace(/\s+/g, ' ').trim();
      const wrap = doc.splitTextToSize(teks, innerW - 4);
      doc.text(wrap, margin, y);
      y += wrap.length * 4.2 + 1.2;
    }
  }
  y += 5;

  // Scoring table — tiap komponen memakai huruf urut sendiri (A–D)
  for (const comp of ['K1', 'K2', 'K3', 'K4'] as const) {
    const compIns = ins.filter(i => i.component === comp);
    if (!compIns.length) continue;

    if (y > 215) { doc.addPage(); y = 20; }
    const info = KOMPONEN_INFO[comp];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setFillColor(23, 63, 112);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, innerW, 7, 'F');
    doc.text(`${info.urut} ${info.judul} (Bobot: ${bobot[comp]}%)`, margin + 2, y + 5);
    y += 11;
    doc.setTextColor(0, 0, 0);

    const hdr = ['No', 'Indikator', 'Dok', 'Skor', 'Kriteria Penilaian', 'Catatan'];
    // Lebar kolom dikunci eksplisit supaya penjumlahan tepat = lebar dalam
    // halaman. Tidak ada kolom yang "kebagian sisa", jadi tidak ada teks
    // yang terpotong tepi kanan.
    const w = [8, 58, 11, 12, 56, 45];
    const totalW = w.reduce((a, b) => a + b, 0);
    w[1] += innerW - totalW;
    const skorCol = margin + w[0] + w[1];
    const dokCol = skorCol + w[2];
    const kritCol = dokCol + w[3];
    const catCol = kritCol + w[4];

    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, innerW, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    let hx = margin;
    for (const [hi, h] of hdr.entries()) {
      // Judul kolom angka (Dok & Skor) rata tengah kolomnya.
      const tengah = hi === 2 || hi === 3;
      doc.text(h, tengah ? hx + w[hi] / 2 : hx + 1.2, y + 4.0, tengah ? { align: 'center' } : undefined);
      hx += w[hi];
    }
    y += 6;

    doc.setFont('helvetica', 'normal');
    for (const [n, i] of compIns.entries()) {
      const a = items.find(x => x.indicatorId === i.id);
      const isNA = a?.na;
      const score = a?.score;
      const dok = i.documents?.length ? String(i.documents.length) : '-';
      // PDF bawaan jsPDF memakai font standar Windows-1252: huruf di luar
      // rentang itu (mis. á, š, „) tampil sebagai petak/kotak. Ganti dulu
      // agar deskriptor rubrik tetap terbaca.
      const GANTI: Record<string, string> = {
        '\u0161': 's', '\u0160': 'S', '\u017e': 'z', '\u017d': 'Z',
        '\u010d': 'c', '\u010c': 'C', '\u0107': 'c', '\u0106': 'C',
        '\u0111': 'd', '\u0110': 'D', '\u201e': '"', '\u201c': '"',
        '\u201d': '"', '\u2018': "'", '\u2019': "'", '\u2013': '-',
        '\u2014': '-', '\u2022': '-', '\u2026': '...', '\u0113': 'e',
        '\u0117': 'e', '\u012f': 'i', '\u016b': 'u', '\u0101': 'a',
      };
      const bersihPdf = (v: unknown) =>
        bersih(v).replace(/[\u0100-\u02FF\u2010-\u203A]/g, c => GANTI[c] ?? '');
      const krit = bersihPdf((i.criteria as Record<string, string>)?.[String(score ?? 0)]) || '-';
      const cat = bersihPdf(a?.notes || a?.finding || '') || '-';

      const txtIndikator = doc.splitTextToSize(bersihPdf(`${i.code} — ${i.title || i.description}`), w[1] - 3);
      const txtKriteria = doc.splitTextToSize(krit, w[4] - 3);
      const txtCatatan = doc.splitTextToSize(cat, w[5] - 3);
      const baris = Math.max(txtIndikator.length, txtKriteria.length, txtCatatan.length, 1);
      const hBaris = baris * 3.3 + 2.6;

      if (y + hBaris > 282) { doc.addPage(); y = 20; }

      doc.setDrawColor(148, 163, 184);
      doc.rect(margin, y, innerW, hBaris);
      doc.line(skorCol, y, skorCol, y + hBaris);
      doc.line(dokCol, y, dokCol, y + hBaris);
      doc.line(kritCol, y, kritCol, y + hBaris);
      doc.line(catCol, y, catCol, y + hBaris);

      doc.setFontSize(7);
      doc.text(String(n + 1), margin + 2, y + 3.6, { align: 'center' });
      doc.text(txtIndikator, margin + w[0] + 1.5, y + 3.6);
      doc.text(dok, dokCol + w[2] / 2, y + 3.6, { align: 'center' });
      const skor = isNA ? 'N/A' : String(score ?? '-');
      doc.setFont('helvetica', isNA ? 'normal' : 'bold');
      doc.text(skor, skorCol + w[2] / 2, y + 3.6, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.text(txtKriteria, kritCol + 1.5, y + 3.6);
      doc.text(txtCatatan, catCol + 1.5, y + 3.6);
      y += hBaris;
    }

    // Nilai komponen + butir yang tidak berlaku pada jenjang ini
    const nilai = calc.components[comp].toFixed(2);
    const semuaKomponen = master.filter(i => i.component === comp && i.active !== false);
    const luarJenjang = semuaKomponen.filter(i => !compIns.some(c => c.id === i.id)).map(i => i.code);
    const twTeks = `Jumlah Butir Dinilai: ${compIns.length}` + (luarJenjang.length ? `  |  Tidak berlaku pada jenjang ${jenjang}: ${luarJenjang.join(', ')}` : '') + `  |  Nilai ${comp}: ${nilai}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setFillColor(241, 245, 249);
    const barisFooter = doc.splitTextToSize(twTeks, innerW - 4);
    const hFooter = barisFooter.length * 3.4 + 3;
    doc.rect(margin, y, innerW, hFooter, 'F');
    doc.text(barisFooter, margin + 2, y + 4);
    y += hFooter + 4;
  }

  // Nilai akhir & predikat
  if (y > 235) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setFillColor(23, 63, 112);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, innerW, 7, 'F');
  doc.text('E. Nilai Akhir dan Predikat', margin + 2, y + 5);
  y += 11;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  // Tabel nilai komponen
  const kolW = innerW / 5;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, innerW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  const head = ['Komponen', 'K1', 'K2', 'K3', 'K4'];
  head.forEach((h, i) => doc.text(h, margin + kolW * i + 2, y + 4.2));
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.rect(margin, y, innerW, 6);
  const nilaiBaris = ['Nilai (0–100)', ...['K1', 'K2', 'K3', 'K4'].map(k => (calc.components as Record<string, number>)[k].toFixed(2))];
  nilaiBaris.forEach((v, i) => doc.text(v, margin + kolW * i + 2, y + 4.2));
  y += 6;
  doc.rect(margin, y, innerW, 6);
  const bobotBaris = ['Bobot', ...['K1', 'K2', 'K3', 'K4'].map(k => `${(bobot as Record<string, number | undefined>)[k] ?? 0}%`)];
  bobotBaris.forEach((v, i) => doc.text(v, margin + kolW * i + 2, y + 4.2));
  y += 11;

  doc.setFontSize(10);
  doc.text('Nilai Akhir (Prestasi Kerja):', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(calc.final.toFixed(2), margin + 62, y);
  doc.setFontSize(10);
  doc.text('Predikat:', margin + 92, y);
  doc.text(bersih(calc.predicate), margin + 112, y);
  y += 11;

  // Prioritas PKB
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setFillColor(23, 63, 112);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, innerW, 7, 'F');
  doc.text('F. Prioritas Pengembangan Keprofesian Berkelanjutan (PKB)', margin + 2, y + 5);
  y += 11;
  doc.setTextColor(0, 0, 0);

  const wPkb = [16, 12, 30, innerW - 16 - 12 - 30];
  const pkbKodeCol = margin + wPkb[0];
  const pkbSkorCol = pkbKodeCol + wPkb[1];
  const pkbPrioCol = pkbSkorCol + wPkb[2];
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, innerW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Kode', margin + 1.5, y + 4.2);
  doc.text('Skor', pkbKodeCol + 1.5, y + 4.2);
  doc.text('Kategori', pkbSkorCol + 1.5, y + 4.2);
  doc.text('Rekomendasi PKB', pkbPrioCol + 1.5, y + 4.2);
  y += 6;
  doc.setFont('helvetica', 'normal');
  for (const p of priorities.slice(0, 10)) {
    const rek = bersih(p.rekomendasiPKB) || '-';
    const tRek = doc.splitTextToSize(rek, wPkb[3] - 3);
    const hBaris = Math.max(tRek.length, 1) * 3.6 + 2.6;
    if (y + hBaris > 282) { doc.addPage(); y = 20; }
    doc.setDrawColor(148, 163, 184);
    doc.rect(margin, y, innerW, hBaris);
    doc.line(pkbKodeCol, y, pkbKodeCol, y + hBaris);
    doc.line(pkbSkorCol, y, pkbSkorCol, y + hBaris);
    doc.line(pkbPrioCol, y, pkbPrioCol, y + hBaris);
    doc.setFontSize(7.5);
    doc.text(bersih(p.code), margin + 1.5, y + 3.8);
    doc.text(String(p.score), pkbKodeCol + 1.5, y + 3.8);
    doc.text(bersih(p.priority), pkbSkorCol + 1.5, y + 3.8);
    doc.text(tRek, pkbPrioCol + 1.5, y + 3.8);
    y += hBaris;
  }
  y += 4;

  // Tanda tangan — menempel 8mm di bawah konten terakhir
  if (y > 250) { doc.addPage(); y = 20; }
  const kota = bersih((org as OrgLike).district).replace(/^kabupaten\s+/i, '') || 'Jember';
  tandaTangan(doc, org, kota, y + 8);
  y += 38;

  // Catatan verifikasi
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  if (y > 285) { doc.addPage(); y = 20; }
  doc.text(`Dokumen ini diterbitkan melalui e-PKPM. Verifikasi keaslian: https://pkpm.pokjawasjember.com/verify/${bersih(result.id)}`, margin, y);
}

/** PDF laporan individu untuk satu pengawas. */
export async function generateIndividualPdf(
  supervisor: Supervisor,
  items: Assessment[],
  master: Indicator[],
  result: Result,
  regulasi: Regulasi[],
  org: OrgLike,
  penilai?: string,
) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  renderIndividual(doc, supervisor, items, master, result, regulasi, org, penilai);
  return doc.output('blob');
}

/**
 * PDF gabungan berisi laporan individu seluruh pengawas.
 * Setiap pengawas dimulai pada halaman baru.
 */
export async function generateBatchPdf(
  entries: { supervisor: Supervisor; items: Assessment[]; master: Indicator[]; result: Result; regulasi: Regulasi[] }[],
  org: OrgLike,
  users?: { id: string; name: string }[],
) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  entries.forEach((e, i) => {
    if (i > 0) doc.addPage();
    const penilai = users?.find(u => u.id === e.result.assessorId)?.name;
    renderIndividual(doc, e.supervisor, e.items, e.master, e.result, e.regulasi, org, penilai);
  });
  const tanggal = new Date().toISOString().slice(0, 10);
  doc.setProperties({ title: `Rekap Laporan PKPM ${tanggal}`, creator: 'e-PKPM' });
  return doc.output('blob');
}

export async function generateKetuaPdf(
  results: { supervisor: Supervisor; result: Result; calc: ReturnType<typeof calculate> }[],
  org: { name: string; chairman: string; headOffice: string },
) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const margin = 15;
  const innerW = 210 - margin * 2;
  let y = 25;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN REKAPITULASI HASIL PKPM', margin, y, { align: 'center' });
  y += 7;
  doc.setFontSize(11);
  doc.text('KEPADA KEPALA KANTOR', margin, y, { align: 'center' });
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(org.name, margin, y, { align: 'center' });
  y += 10;

  // Table header
  const cols = [
    { w: 8, label: 'No' },
    { w: 40, label: 'Nama' },
    { w: 20, label: 'Jenjang' },
    { w: 16, label: 'K1' },
    { w: 16, label: 'K2' },
    { w: 16, label: 'K3' },
    { w: 16, label: 'K4' },
    { w: 18, label: 'Akhir' },
    { w: 30, label: 'Predikat' },
  ];
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, innerW, 5, 'F');
  let cx = margin;
  for (const col of cols) {
    doc.text(col.label, cx + 1, y + 4);
    cx += col.w;
  }
  y += 7;

  doc.setFont('helvetica', 'normal');
  for (let i = 0; i < results.length; i++) {
    if (y > 260) { doc.addPage(); y = 25; }
    const { supervisor, calc } = results[i];
    cx = margin;
    doc.text(String(i + 1), cx + 1, y + 4); cx += cols[0].w;
    doc.text(supervisor.name, cx + 1, y + 4); cx += cols[1].w;
    doc.text(supervisor.level || '-', cx + 1, y + 4); cx += cols[2].w;
    doc.text(calc.components.K1.toFixed(1), cx + 1, y + 4); cx += cols[3].w;
    doc.text(calc.components.K2.toFixed(1), cx + 1, y + 4); cx += cols[4].w;
    doc.text(calc.components.K3.toFixed(1), cx + 1, y + 4); cx += cols[5].w;
    doc.text(calc.components.K4.toFixed(1), cx + 1, y + 4); cx += cols[6].w;
    doc.text(calc.final.toFixed(2), cx + 1, y + 4); cx += cols[7].w;
    doc.text(calc.predicate, cx + 1, y + 4);
    y += 5;
  }

  // Summary
  y += 5;
  if (y > 240) { doc.addPage(); y = 25; }
  const predSummary: Record<string, number> = {};
  for (const r of results) { predSummary[r.calc.predicate] = (predSummary[r.calc.predicate] || 0) + 1; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Rekap Predikat:', margin, y); y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (const [pred, count] of Object.entries(predSummary)) {
    doc.text(`${pred}: ${count} pengawas`, margin, y); y += 4;
  }

  // Signatures
  y += 10;
  if (y > 220) { doc.addPage(); y = 25; }
  doc.setFontSize(9);
  doc.text('Ketua Pokjawas,', margin, y);
  y += 5;
  doc.text(org.chairman, margin, y);
  y += 15;
  doc.text('( _________________________ )', margin, y);

  return doc.output('blob');
}

/**
 * Buka PDF pada tab baru sehingga pengguna dapat meninjau dan memilih
 * pengaturan cetak pada dialog cetak bawaan browser.
 *
 * @returns true jika tab pratinjau berhasil dibuka
 */
export function openPdfTab(blob: Blob): boolean {
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank');
  if (tab) setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return !!tab;
}

/**
 * Buka PDF lalu langsung munculkan Pengaturan Cetak browser (Ctrl/Cmd + P),
 * sehingga pengguna bisa memilih orientasi potret/lanskap, ukuran kertas,
 * dan margin sebelum mencetak atau menyimpan PDF.
 *
 * @returns true jika tab berhasil dibuka
 */
export function printPdf(blob: Blob): boolean {
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank');
  if (!tab) return false;
  // Tunggu viewer PDF memuat berkas, baru buka pengaturan cetak.
  const pinjam = tab as Window & { __cetak?: boolean };
  setTimeout(() => {
    try {
      if (!pinjam.__cetak && !pinjam.closed) {
        pinjam.__cetak = true;
        pinjam.focus();
        pinjam.print();
      }
    } catch {
      /* pengguna tetap dapat menekan Ctrl/Cmd + P secara manual */
    }
  }, 900);
  return true;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}