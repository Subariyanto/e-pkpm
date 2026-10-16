/**
 * Ringkasan hasil penilaian — dipakai bersama oleh halaman Penilaian V2
 * (langkah akhir instrumen) dan halaman Cetak Instrumen.
 *
 * Keduanya menampilkan dua hal yang sama:
 *   1. Catatan Hasil Penilaian — narasi mengalir: cakupan, sebaran skor & kualitas,
 *      butir prioritas perbaikan, tindak lanjut, simpulan akhir
 *   2. Rencana Tindak Lanjut   — daftar butir berskor 0–1 beserta tindakannya
 *
 * Catatan: narasi sengaja TIDAK menyebutkan nomor/kode butir (mis. K1.3) agar
 * enak dibaca sebagai kesimpulan; butir dirujuk lewat judulnya.
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

/** Judul butir dipangkas agar kalimat tetap enak dibaca. */
function judul(ind: Indicator, maks = 9) {
  const teks = (ind.title || ind.description || '').replace(/\s+/g, ' ').trim();
  if (!teks) return 'butir instrumen';
  const kata = teks.split(' ');
  return kata.length <= maks ? teks : `${kata.slice(0, maks).join(' ')}`;
}

/**
 * Narasi Catatan Hasil Penilaian — kesimpulan dari skor seluruh komponen.
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

  if (!dinilai.length) {
    return [
      'Belum ada butir instrumen yang dinilai, sehingga kesimpulan hasil penilaian belum dapat dirumuskan. Seluruh butir perlu diberi skor terlebih dahulu.',
    ];
  }

  const subjek = pengawas ? `Pengawas ${pengawas}` : 'Pengawas yang dinilai';
  const p: string[] = [];

  // ===== 1. Cakupan penilaian =====
  p.push(
    `Berdasarkan hasil penilaian kinerja pengawas madrasah terhadap ${subjek}, dari ${rows.length} butir instrumen yang dinilai ${dinilai.length} butir telah diberi skor` +
      (na.length
        ? ` dan ${na.length} butir dinyatakan tidak berlaku (N/A) sesuai jenjang jabatan maupun penugasan yang bersangkutan`
        : '') +
      '. Seluruh butir tersebut tersebar pada empat komponen penilaian, yaitu penyusunan program pengawasan (K1), pelaksanaan program pengawasan (K2), evaluasi hasil pelaksanaan program pengawasan (K3), serta pembimbingan dan pelatihan profesional pengawas madrasah (K4).',
  );

  // ===== 2. Sebaran skor + simpulan kualitas + kekuatan/kelemahan =====
  const sebaran: string[] = [];
  if (tinggi.length) sebaran.push(`${tinggi.length} butir (${persen(tinggi.length)}%) memperoleh skor 2`);
  if (partial.length) sebaran.push(`${partial.length} butir (${persen(partial.length)}%) memperoleh skor 1`);
  if (nol.length) sebaran.push(`${nol.length} butir (${persen(nol.length)}%) memperoleh skor 0`);

  const kualitas =
    tinggi.length >= dinilai.length * 0.8
      ? 'Secara umum pelaksanaan tugas kepengawasan sudah terlaksana lengkap dan sesuai ketentuan, dengan hanya sedikit aspek yang masih memerlukan penyempurnaan.'
      : partial.length + nol.length >= dinilai.length
        ? 'Seluruh kegiatan telah terlaksana, namun masih terdapat aspek yang belum sepenuhnya didukung bukti dan dokumen yang memadai sehingga memerlukan perbaikan.'
        : 'Sebagian besar kegiatan telah terlaksana dengan baik, namun beberapa butir masih memerlukan perbaikan agar seluruh tahapan kepengawasan berjalan lengkap dan terdokumentasi.';

  const kekuatan = tinggi.length
    ? 'Kekuatan utama terletak pada aspek yang telah terlaksana lengkap, sesuai ketentuan, dan didukung bukti yang memadai'
    : 'Belum tampak kekuatan yang menonjol karena belum ada butir yang mencapai skor 2';
  const kelemahan = rendah.length
    ? 'sedangkan perhatian utama difokuskan pada aspek yang belum mencapai skor 2, terutama pada kelengkapan bukti dukung dan dokumen tindak lanjut hasil kegiatan.'
    : 'dan seluruh aspek telah terpenuhi tanpa temuan yang memerlukan perbaikan.';

  p.push(
    (sebaran.length ? `Skor tersebut terdiri atas ${daftarKata(sebaran)}. ` : '') +
      `${kualitas} ${kekuatan}, ${kelemahan}`,
  );

  // ===== 3. Butir prioritas perbaikan (dirujuk lewat judul, tanpa nomor butir) =====
  if (rendah.length) {
    const judulLemah = rendah.map(r => judul(r.ind));
    const tampil = judulLemah.length > 6 ? [...judulLemah.slice(0, 6), 'dan beberapa aspek lain'] : judulLemah;
    p.push(
      `Butir yang belum mencapai skor 2 dan menjadi prioritas perbaikan sebanyak ${rendah.length} butir, meliputi aspek ${daftarKata(tampil)}. ` +
        'Pada butir-butir tersebut, kelengkapan bukti dukung dan dokumen tindak lanjut hasil kegiatan dinilai belum memadai sehingga berpotensi melemahkan keterukuran capaian kepengawasan.',
    );
  } else {
    p.push(
      'Tidak ditemukan butir dengan skor 0–1. Seluruh kegiatan telah terlaksana lengkap, sesuai ketentuan, serta didukung bukti yang memadai sehingga tidak diperlukan perbaikan mendasar.',
    );
  }

  // ===== 4. Tindak lanjut =====
  if (rendah.length) {
    p.push(
      `Sebagai tindak lanjut, kepada pengawas yang dinilai diharapkan menyusun rencana perbaikan pada ${rendah.length} butir tersebut melalui kegiatan pengembangan keprofesian berkelanjutan, melengkapi bukti dukung dan dokumen tindak lanjut hasil kegiatan, serta menyampaikan hasilnya untuk diverifikasi pada periode penilaian berikutnya.`,
    );
  } else if (na.length) {
    p.push(
      'Rekomendasi diarahkan pada pemeliharaan dan penguatan mutu kinerja yang telah tercapai, disertai penyesuaian kejelasan penugasan pada butir yang dinyatakan tidak berlaku (N/A).',
    );
  } else {
    p.push(
      'Rekomendasi diarahkan pada pemeliharaan dan penguatan mutu kinerja yang telah tercapai agar capaian baik ini tetap konsisten pada periode penilaian berikutnya.',
    );
  }

  // ===== 5. Simpulan akhir + predikat =====
  if (typeof hasil?.final === 'number') {
    const komp: string[] = [];
    for (const k of ['K1', 'K2', 'K3', 'K4']) {
      const v = hasil.components?.[k];
      if (typeof v === 'number') komp.push(`${k} sebesar ${v.toFixed(2)}`);
    }
    p.push(
      `Dengan demikian, nilai akhir kinerja ${subjek} adalah ${hasil.final.toFixed(2)} dengan predikat ${hasil.predicate || '-'}` +
        (komp.length ? `, yang diperoleh dari rata-rata capaian ${daftarKata(komp)}` : '') +
        '. Predikat ini menjadi simpulan akhir penilaian kinerja pengawas madrasah untuk periode penilaian yang bersangkutan.',
    );
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
