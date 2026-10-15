import jsPDF from 'jspdf';
import type { Assessment, Indicator, Result, Supervisor, Regulasi, PredikatRow } from '../types';
import { calculate, computePriorities, indicatorsForJenjang } from '../services/core';
import { BOBOT_DEFAULT, PREDIKAT_DEFAULT } from '../data/demo';

function autoTable(doc: jsPDF, rows: any[], y: number, margin: number, pageW: number) {
  const colW = [10, pageW - margin * 2 - 10 - 20 - 20, 20, 20, 20];
  const lineH = 6;
  doc.setFontSize(8);
  for (const row of rows) {
    if (y > 260) { doc.addPage(); y = 25; }
    doc.setFont('helvetica', 'bold');
    doc.text(String(row[0]), margin, y);
    doc.setFont('helvetica', 'normal');
    const text = doc.splitTextToSize(row[1], colW[1]);
    doc.text(text, margin + colW[0], y);
    for (let i = 1; i <= 3; i++) {
      const score = row[1 + i];
      if (score === '✓') doc.setFont('helvetica', 'bold');
      doc.text(String(score), margin + colW[0] + colW[1] + 20 * (i - 1), y);
      doc.setFont('helvetica', 'normal');
    }
    y += Math.max(lineH * 3, text.length * lineH);
  }
  return y;
}

function renderIndividual(
  doc: jsPDF,
  supervisor: Supervisor,
  items: Assessment[],
  master: Indicator[],
  result: Result,
  regulasi: Regulasi[],
  org: { name: string; chairman: string; headOffice: string },
) {
  const margin = 15;
  const pageW = 210;
  const innerW = pageW - margin * 2;
  let y = 25;
  const bobot = BOBOT_DEFAULT;
  const preds = PREDIKAT_DEFAULT as PredikatRow[];
  const calc = calculate(items, master, preds, bobot);
  const priorities = computePriorities(items, master, bobot);
  const jenjang = supervisor.level || 'Madya';
  const ins = indicatorsForJenjang(master, jenjang);

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN HASIL PENILAIAN KINERJA', margin, y, { align: 'center' });
  y += 7;
  doc.setFontSize(11);
  doc.text('PENGELOLAAN KINERJA PENGAWAS MADRASAH (PKPM)', margin, y, { align: 'center' });
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(org.name, margin, y, { align: 'center' });
  y += 10;

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
    ['Nama', ': ' + supervisor.name],
    ['NIP', ': ' + supervisor.nip],
    ['Pangkat / Golongan', ': ' + supervisor.rank],
    ['Jenjang Jabatan', ': ' + jenjang],
    ['Satuan Kerja', ': ' + supervisor.workUnit],
    ['Wilayah Binaan', ': ' + supervisor.region],
  ];
  for (const [k, v] of identity) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(k, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, margin + 45, y);
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
  doc.text(`Nomor SK / Surat Tugas: ${result.skPenugasan || '-'}`, margin, y); y += 5;
  doc.text(`Tanggal SK: ${result.tanggalSk || '-'}`, margin, y); y += 5;
  doc.text(`Penilai: ${result.assessorId || '-'}`, margin, y); y += 5;
  doc.text(`Mekanisme: ${result.mekanismePenilaian || 'individual'}`, margin, y); y += 5;
  doc.text(`Tanggal Finalisasi: ${result.finalizedAt ? new Date(result.finalizedAt).toLocaleDateString('id-ID') : '-'}`, margin, y); y += 5;

  // Dasar Hukum
  const regulasiUtama = regulasi.filter(r => r.status === 'berlaku').slice(0, 3);
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
      doc.text(`${r.nomor} tentang ${r.tentang}`, margin, y);
      y += 5;
    }
  }
  y += 5;

  // Scoring table
  for (const [ci, comp] of (['K1', 'K2', 'K3', 'K4'] as const).entries()) {
    const compIns = ins.filter(i => i.component === comp);
    if (!compIns.length) continue;

    if (y > 240) { doc.addPage(); y = 25; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setFillColor(23, 63, 112);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, innerW, 7, 'F');
    const labels = ['Penyusunan Program', 'Pelaksanaan Program', 'Evaluasi Hasil', 'Pembimbingan & Pelatihan'];
    doc.text(`${comp}: ${labels[ci]} (Bobot: ${bobot[comp]}%)`, margin + 2, y + 5);
    y += 12;
    doc.setTextColor(0, 0, 0);

    // Header row
    doc.setFontSize(7);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, innerW, 5, 'F');
    doc.text('No', margin + 2, y + 4);
    doc.text('Indikator', margin + 10, y + 4);
    doc.text('0', margin + innerW - 40, y + 4);
    doc.text('1', margin + innerW - 30, y + 4);
    doc.text('2', margin + innerW - 20, y + 4);
    y += 7;

    const rows = compIns.map((i, n) => {
      const a = items.find(x => x.indicatorId === i.id);
      const isNA = a?.na;
      const score = a?.score;
      return [
        n + 1,
        `${i.code}: ${i.title || i.description}` + (isNA ? ' (N/A)' : ''),
        score === 0 ? '✓' : '',
        score === 1 ? '✓' : '',
        score === 2 ? '✓' : '',
      ];
    });
    y = autoTable(doc, rows, y, margin, pageW);

    // Component score
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Nilai ${comp}: ${calc.components[comp].toFixed(1)}`, margin, y);
    y += 7;
  }

  // Final result
  if (y > 240) { doc.addPage(); y = 25; }
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setFillColor(23, 63, 112);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, innerW, 7, 'F');
  doc.text('D. Nilai Akhir dan Predikat', margin + 2, y + 5);
  y += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nilai K1: ${calc.components.K1.toFixed(1)} (Bobot: ${bobot.K1}%)`, margin, y); y += 5;
  doc.text(`Nilai K2: ${calc.components.K2.toFixed(1)} (Bobot: ${bobot.K2}%)`, margin, y); y += 5;
  doc.text(`Nilai K3: ${calc.components.K3.toFixed(1)} (Bobot: ${bobot.K3}%)`, margin, y); y += 5;
  doc.text(`Nilai K4: ${calc.components.K4.toFixed(1)} (Bobot: ${bobot.K4}%)`, margin, y); y += 5;
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Nilai Akhir: ${calc.final.toFixed(2)}`, margin, y); y += 7;
  doc.text(`Predikat: ${calc.predicate}`, margin, y); y += 7;

  // PKB Priority
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setFillColor(23, 63, 112);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, innerW, 7, 'F');
  doc.text('E. Prioritas PKB', margin + 2, y + 5);
  y += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  for (const p of priorities.slice(0, 8)) {
    if (y > 260) { doc.addPage(); y = 25; }
    const priorityIcon = p.priority === 'Sangat Tinggi' ? '🔴' : p.priority === 'Tinggi' ? '🟡' : '🟢';
    doc.text(`${priorityIcon} ${p.code} — Skor: ${p.score} — ${p.priority}`, margin, y);
    y += 4;
    if (p.rekomendasiPKB) {
      doc.setFontSize(7);
      doc.text(`   Rekomendasi: ${p.rekomendasiPKB}`, margin + 5, y);
      doc.setFontSize(8);
      y += 4;
    }
  }

  // Signatures
  y += 5;
  if (y > 220) { doc.addPage(); y = 25; }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Mengetahui,', margin + innerW * 0.6, y); y += 5;
  doc.text('Kepala Kantor', margin + innerW * 0.6, y); y += 5;
  doc.text(org.headOffice, margin + innerW * 0.6, y); y += 15;
  doc.text('( _________________________ )', margin + innerW * 0.6, y); y += 5;
  doc.text('NIP.', margin + innerW * 0.6, y); y += 5;

  y = 140;
  doc.text('Ketua Pokjawas,', margin, y); y += 5;
  doc.text(org.chairman, margin, y); y += 15;
  doc.text('( _________________________ )', margin, y); y += 5;
  doc.text('NIP.', margin, y);

  // QR code placeholder + verification note
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  const verifyUrl = `https://pkpm.pokjawasjember.com/verify/${result.id}`;
  doc.text(`Verifikasi: ${verifyUrl}`, margin, 280);
}

/** PDF laporan individu untuk satu pengawas. */
export async function generateIndividualPdf(
  supervisor: Supervisor,
  items: Assessment[],
  master: Indicator[],
  result: Result,
  regulasi: Regulasi[],
  org: { name: string; chairman: string; headOffice: string },
) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  renderIndividual(doc, supervisor, items, master, result, regulasi, org);
  return doc.output('blob');
}

/**
 * PDF gabungan berisi laporan individu seluruh pengawas.
 * Setiap pengawas dimulai pada halaman baru.
 */
export async function generateBatchPdf(
  entries: { supervisor: Supervisor; items: Assessment[]; master: Indicator[]; result: Result; regulasi: Regulasi[] }[],
  org: { name: string; chairman: string; headOffice: string },
) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  entries.forEach((e, i) => {
    if (i > 0) doc.addPage();
    renderIndividual(doc, e.supervisor, e.items, e.master, e.result, e.regulasi, org);
  });
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
  return !!window.open(url, '_blank');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}