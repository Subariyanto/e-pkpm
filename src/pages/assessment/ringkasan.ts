/**
 * Ringkasan hasil penilaian — dipakai bersama oleh halaman Penilaian V2
 * (langkah akhir instrumen) dan halaman Cetak Instrumen.
 *
 * Keduanya menampilkan dua hal yang sama:
 *   1. Catatan Hasil Penilaian — narasi ringkas: simpulan umum, KEKUATAN, KELEMAHAN, tindak lanjut
 *   2. Rencana Tindak Lanjut   — daftar butir berskor 0–1 beserta tindakannya
 */
import { AUTO_ISI } from '../../data/demo';
import type { Assessment, Indicator } from '../../types';

export type BarisRingkas = { ind: Indicator; a?: Partial<Assessment> };

export type HasilPredikat = {
  final?: number;
  predicate?: string;
  components?: Record<string, number>;
};

/** "a, b, dan c" — daftar gaya bahasa Indonesia. */
function daftarKata(items: string[]): string {
  if (!items.length) return '-';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')}, dan ${items.at(-1)}`;
}

/**
 * Narasi Catatan Hasil Penilaian — ringkas, menonjolkan kekuatan dan kelemahan.
 * `hasil` opsional (nilai akhir + rincian K1–K4), `pengawas` opsional (nama).
 */
export function catatanHasil(rows: BarisRingkas[], hasil?: HasilPredikat, pengawas?: string): string[] {
  const dinilai = rows.filter(r => r.a && !r.a.na && r.a.score !== undefined);
  const na = rows.filter(r => r.a?.na);
  const partial = dinilai.filter(r => (r.a!.score as number) === 1);
  const nol = dinilai.filter(r => (r.a!.score as number) === 0);
  const tinggi = dinilai.filter(r => (r.a!.score as number) === 2);
  const rendah = dinilai.filter(r => (r.a!.score as number) <= 1);
  const persen = (n: number) => (dinilai.length ? Math.round((n / dinilai.length) * 100) : 0);
  const kode = (arr: BarisRingkas[]) => daftarKata(arr.map(r => r.ind.code));

  if (!dinilai.length) {
    return ['Belum ada butir instrumen yang dinilai, sehingga kesimpulan hasil penilaian belum dapat dirumuskan.'];
  }

  const subjek = pengawas ? `Pengawas ${pengawas}` : 'Pengawas yang dinilai';
  const p: string[] = [];

  // ===== 1. Simpulan umum =====
  const sebaran: string[] = [];
  if (tinggi.length) sebaran.push(`${tinggi.length} butir (${persen(tinggi.length)}%) berskor 2`);
  if (partial.length) sebaran.push(`${partial.length} butir (${persen(partial.length)}%) berskor 1`);
  if (nol.length) sebaran.push(`${nol.length} butir (${persen(nol.length)}%) berskor 0`);

  let nilaiAkhir = '';
  if (typeof hasil?.final === 'number') {
    const komp = ['K1', 'K2', 'K3', 'K4']
      .map(k => (typeof hasil.components?.[k] === 'number' ? `${k} ${hasil.components[k].toFixed(2)}` : ''))
      .filter(Boolean);
    nilaiAkhir =
      ` Nilai akhir ${hasil.final.toFixed(2)} dengan predikat ${hasil.predicate || '-'}` +
      (komp.length ? ` (${komp.join(', ')}).` : '.');
  }

  p.push(
    `Hasil penilaian kinerja ${subjek} dari ${rows.length} butir instrumen: ${dinilai.length} butir dinilai` +
      (na.length ? ` dan ${na.length} butir N/A` : '') +
      `, terdiri atas ${daftarKata(sebaran)}.${nilaiAkhir}`,
  );

  // ===== 2. Kekuatan =====
  if (tinggi.length) {
    // Komponen dengan capaian tertinggi (bila tersedia) untuk menyebut unggulan.
    let terbaik = '';
    if (hasil?.components) {
      const entri = ['K1', 'K2', 'K3', 'K4']
        .filter(k => typeof hasil.components?.[k] === 'number')
        .map(k => [k, hasil.components![k]] as const);
      if (entri.length) {
        const [k, v] = entri.reduce((a, b) => (b[1] > a[1] ? b : a));
        terbaik = ` Capaian tertinggi ada pada komponen ${k} (${v.toFixed(2)}).`;
      }
    }
    p.push(
      `Kekuatan: ${tinggi.length} butir (${persen(tinggi.length)}%) telah terlaksana lengkap, sesuai ketentuan, dan didukung bukti yang memadai sehingga memperoleh skor 2.${terbaik}`,
    );
  } else {
    p.push('Kekuatan: belum ada butir yang memperoleh skor 2, sehingga capaian kinerja masih perlu ditingkatkan secara menyeluruh.');
  }

  // ===== 3. Kelemahan =====
  if (rendah.length) {
    const rincian: string[] = [];
    if (partial.length) rincian.push(`${partial.length} butir berskor 1`);
    if (nol.length) rincian.push(`${nol.length} butir berskor 0`);
    p.push(
      `Kelemahan: ${daftarKata(rincian)} dinilai belum memadai karena kelengkapan bukti dukung dan dokumen tindak lanjut hasil kegiatan belum tersedia, yaitu ${kode(rendah)}.`,
    );
  } else {
    p.push('Kelemahan: tidak ditemukan butir berskor 0–1; seluruh kegiatan telah terlaksana lengkap dan terdokumentasi.');
  }

  // ===== 4. Tindak lanjut =====
  p.push(
    rendah.length
      ? `Tindak lanjut: melengkapi bukti dukung dan dokumen tindak lanjut pada ${rendah.length} butir tersebut melalui pengembangan keprofesian berkelanjutan, sekaligus mempertahankan capaian pada butir yang sudah berskor 2.`
      : 'Tindak lanjut: mempertahankan dan memperkuat mutu kinerja yang telah tercapai pada periode penilaian berikutnya.',
  );

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
