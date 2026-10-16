/**
 * Ringkasan hasil penilaian — dipakai bersama oleh halaman Penilaian V2
 * (langkah akhir instrumen) dan halaman Cetak Instrumen.
 *
 * Keduanya menampilkan dua hal yang sama:
 *   1. Catatan Hasil Penilaian — narasi otomatis dari skor seluruh komponen
 *   2. Rencana Tindak Lanjut   — daftar butir berskor 0–1 beserta tindakannya
 */
import { AUTO_ISI } from '../../data/demo';
import type { Assessment, Indicator } from '../../types';

export type BarisRingkas = { ind: Indicator; a?: Partial<Assessment> };

/** Narasi Catatan Hasil Penilaian dari skor seluruh indikator. */
export function catatanHasil(rows: BarisRingkas[]): string[] {
  const dinilai = rows.filter(r => r.a && !r.a.na && r.a.score !== undefined);
  const na = rows.filter(r => r.a?.na);
  const rendah = dinilai.filter(r => (r.a!.score as number) <= 1);
  const tinggi = dinilai.filter(r => (r.a!.score as number) === 2);

  const p: string[] = [];
  p.push(
    `Dari ${rows.length} butir instrumen, ${dinilai.length} butir telah dinilai dan ${na.length} butir dinyatakan tidak berlaku (N/A) sesuai jenjang jabatan maupun penugasan pengawas.`,
  );
  if (tinggi.length) {
    p.push(
      `Sebanyak ${tinggi.length} butir memperoleh skor 2 (terlaksana lengkap dan sesuai), yaitu: ${tinggi
        .map(r => r.ind.code)
        .join(', ')}.`,
    );
  }
  if (rendah.length) {
    p.push(
      `Sebanyak ${rendah.length} butir memperoleh skor 0–1 sehingga memerlukan perbaikan, yaitu: ${rendah
        .map(r => `${r.ind.code} (skor ${r.a!.score})`)
        .join(', ')}.`,
    );
  } else if (dinilai.length) {
    p.push('Tidak ditemukan butir dengan skor 0–1; seluruh kegiatan terlaksana lengkap dan sesuai.');
  }
  if (na.length) {
    p.push(`Butir N/A: ${na.map(r => r.ind.code).join(', ')}.`);
  }
  return p;
}

export type ItemRtl = {
  code: string; title: string; score: number;
  masalah: string; tindakan: string; produk: string; bentukPKB: string; status: string;
};

/** Daftar Rencana Tindak Lanjut dari butir berskor 0–1 (urut dari skor terendah). */
export function rekapRTL(rows: BarisRingkas[]): ItemRtl[] {
  const items = rows
    .filter(r => r.a && !r.a.na && r.a.score !== undefined && (r.a.score as number) <= 1)
    .sort((x, y) => (x.a!.score as number) - (y.a!.score as number));
  return items.map(r => {
    const auto = AUTO_ISI[r.a!.score as number];
    return {
      code: r.ind.code,
      title: r.ind.title || r.ind.description || '',
      score: r.a!.score as number,
      masalah: r.a!.rtlMasalah || (auto ? auto.rtlMasalah : '') || '-',
      tindakan: r.a!.rtlTindakan || (auto ? auto.rtlTindakan : '') || '-',
      produk: r.a!.rtlProduk || (auto ? auto.rtlProduk : '') || '-',
      bentukPKB: r.a!.rtlBentukPKB || (auto ? auto.rtlBentukPKB : '') || '-',
      status: r.a!.rtlStatus || (auto ? auto.rtlStatus : '') || '-',
    };
  });
}
