import type {ActivationCode, Indicator, Supervisor, User, Regulasi } from '../types';

// === REGULASI (Section A) ===
export const regulasiData: Regulasi[] = [
  { id: 'r1', nomor: 'PermenPANRB No. 7 Tahun 2026', judul: 'Jabatan Fungsional di Bidang Pendidik dan Pengawasan Mutu Pendidikan', tahun: 2026, status: 'berlaku', kategori: 'Dasar Jabatan Fungsional', catatan: 'Dasar terbaru jabatan fungsional di bidang pendidik dan pengawasan mutu pendidikan.', urutan: 1 },
  { id: 'r2', nomor: 'PP No. 30 Tahun 2019', judul: 'Penilaian Kinerja PNS', tahun: 2019, status: 'berlaku', kategori: 'Pengelolaan Kinerja ASN', urutan: 2 },
  { id: 'r3', nomor: 'PermenPANRB No. 6 Tahun 2022', judul: 'Pengelolaan Kinerja Pegawai ASN', tahun: 2022, status: 'berlaku', kategori: 'Pengelolaan Kinerja ASN', urutan: 3 },
  { id: 'r4', nomor: 'PermenPANRB No. 1 Tahun 2023', judul: 'Jabatan Fungsional', tahun: 2023, status: 'berlaku', kategori: 'Dasar Jabatan Fungsional', urutan: 4 },
  { id: 'r5', nomor: 'Peraturan BKN No. 3 Tahun 2023', judul: 'Ketentuan Pelaksanaan Jabatan Fungsional', tahun: 2023, status: 'berlaku', kategori: 'Ketentuan Teknis', urutan: 5 },
  { id: 'r6', nomor: 'PMA No. 2 Tahun 2012', judul: 'Pengawas Madrasah dan Pengawas PAI pada Sekolah', tahun: 2012, status: 'diubah', kategori: 'Pengawas Madrasah', catatan: 'Diubah dengan PMA No. 31 Tahun 2013.', urutan: 6 },
  { id: 'r7', nomor: 'PMA No. 31 Tahun 2013', judul: 'Perubahan atas PMA No. 2 Tahun 2012', tahun: 2013, status: 'berlaku', kategori: 'Pengawas Madrasah', urutan: 7 },
  { id: 'r8', nomor: 'Kepdirjen Pendis No. 6934 Tahun 2014', judul: 'Pedoman Penilaian Kinerja Pengawas Madrasah', tahun: 2014, status: 'pedoman_teknis', kategori: 'Pedoman Teknis PKPM', catatan: 'Instrumen teknis K1–K4 masih merujuk pada pedoman ini, diselaraskan dengan nomenklatur terbaru.', urutan: 8 },
  { id: 'r9', nomor: 'Permendiknas No. 12 Tahun 2007', judul: 'Standar Pengawas Sekolah/Madrasah', tahun: 2007, status: 'referensi', kategori: 'Referensi Kompetensi', urutan: 9 },
  { id: 'r10', nomor: 'PermenPANRB No. 21 Tahun 2024', judul: 'Jabatan Fungsional Pengawas (lama)', tahun: 2024, status: 'dicabut', kategori: 'Dicabut', catatan: 'Tidak ditampilkan sebagai dasar yang masih berlaku.', urutan: 10 },
];

export const REGULASI_NOTE = 'PermenPANRB Nomor 7 Tahun 2026 menjadi dasar terbaru jabatan fungsional di bidang pendidik dan pengawasan mutu pendidikan. Instrumen teknis K1–K4 masih merujuk pada Pedoman PKPM Kementerian Agama tahun 2014 dan diselaraskan dengan nomenklatur, pengelolaan kinerja ASN, dan kebutuhan pengembangan kompetensi terbaru.';

// === KRITERIA SKOR UMUM (Section C) ===
const kriteriaUmum = {
  0: 'Kegiatan tidak dilaksanakan; dokumen tidak ditemukan; bukti tidak relevan; atau aspek yang terpenuhi kurang dari 40%.',
  1: 'Kegiatan atau dokumen tersedia sebagian; aspek yang terpenuhi sekitar 40% sampai kurang dari 80%; dokumen belum lengkap; analisis belum memadai; hasil atau tindak lanjut belum jelas.',
  2: 'Kegiatan terlaksana; dokumen lengkap, valid, relevan, dan sesuai periode; sekurang-kurangnya 80% aspek terpenuhi; hasil dapat diverifikasi; analisis dan tindak lanjut tersedia sesuai karakteristik indikator.',
};

const metodeStd = ['Telaah dokumen', 'Wawancara/klarifikasi', 'Konfirmasi kepada madrasah binaan', 'Pemeriksaan konsistensi program–pelaksanaan–hasil–RTL'];

function ind(
  component: 'K1'|'K2'|'K3'|'K4', code: string, title: string, description: string,
  jenjang: ('Muda'|'Madya'|'Utama')[], aspek: string[], documents: string[],
  weight: number, order: number, pkb: string, rtlDefault: string,
  kriteriaSkor?: { 0: string; 1: string; 2: string },
): Indicator {
  return {
    id: code, component, subcomponent: code, code, title, description,
    jenjangBerlaku: jenjang, aspek, documents,
    kriteriaSkor: kriteriaSkor || kriteriaUmum,
    metodeVerifikasi: metodeStd,
    rekomendasiPKB: pkb, rtlDefault: rtlDefault as unknown as Partial<import('../types').Rtl>,
    weight, maxScore: 2, required: true, active: true, order,
    versiInstrumen: 'pkpm-0-2-v2',
    periodeMulai: '2026-01-01',
    descriptors: { 0: kriteriaUmum[0], 1: kriteriaUmum[1], 2: kriteriaUmum[2] },
    pkb,
  };
}

// === K1 — PENYUSUNAN PROGRAM PENGAWASAN (Section G) ===
const K1: Indicator[] = [
  ind('K1','K1.1','Program Pengawasan Tahunan',
    'Memiliki Program Pengawasan Tahunan yang disusun berdasarkan evaluasi hasil pengawasan sebelumnya dan kebutuhan madrasah binaan.',
    ['Muda','Madya','Utama'],
    ['Identitas program, periode, dan wilayah binaan','Latar belakang, dasar hukum, tujuan, dan sasaran','Evaluasi hasil program tahun sebelumnya','Pemetaan masalah dan kebutuhan madrasah binaan','Matriks program pengawasan akademik dan manajerial','Jadwal, instrumen, lampiran, dan pengesahan'],
    ['Program Pengawasan Tahunan','Evaluasi program tahun sebelumnya','Peta masalah/kebutuhan','Daftar madrasah binaan','Jadwal tahunan','Lembar pengesahan'],
    1, 0, 'Lokakarya penyusunan program pengawasan tahunan', 'Revisi dan lengkapi program pengawasan tahunan berdasarkan evaluasi tahun sebelumnya.'),

  ind('K1','K1.2','Program Pembinaan Guru dan/atau Kepala Madrasah',
    'Memiliki program pembinaan guru dan/atau kepala madrasah berdasarkan hasil pemetaan kebutuhan.',
    ['Muda','Madya','Utama'],
    ['Analisis kebutuhan','Tujuan pembinaan','Sasaran pembinaan','Target dan indikator keberhasilan','Materi','Strategi/metode','Jadwal dan sumber daya','Instrumen evaluasi dan RTL'],
    ['Analisis kebutuhan pembinaan','Program pembinaan','Daftar sasaran','Jadwal','Materi/modul','Instrumen','Format evaluasi','Format RTL'],
    1, 1, 'Workshop penyusunan program pembinaan berbasis kebutuhan', 'Susun program pembinaan berdasarkan analisis kebutuhan guru/kepala madrasah.'),

  ind('K1','K1.3','Program Pemantauan Mutu/SNP',
    'Memiliki program pemantauan mutu pendidikan dan pemenuhan standar pada madrasah binaan.',
    ['Muda','Madya','Utama'],
    ['Ruang lingkup standar atau mutu yang dipantau','Tujuan','Madrasah sasaran','Target dan indikator','Strategi dan metode','Jadwal','Instrumen','Pengolahan hasil dan RTL'],
    ['Program pemantauan','Peta mutu/EDM','Instrumen pemantauan','Daftar madrasah sasaran','Jadwal','Target mutu','Format pengolahan','Format rekomendasi'],
    1, 2, 'Bimtek pemantauan mutu dan pemenuhan SNP', 'Lengkapi program pemantauan mutu dengan peta EDM dan instrumen terstandar.'),

  ind('K1','K1.4','Program Penilaian Kinerja Guru dan/atau Kepala Madrasah',
    'Memiliki program penilaian kinerja guru dan/atau kepala madrasah sesuai kewenangan dan penugasan.',
    ['Muda','Madya','Utama'],
    ['Ruang lingkup','Tujuan','Daftar sasaran','Target','Jadwal','Metode','Instrumen','Penyampaian hasil dan RTL'],
    ['Program penilaian','Daftar sasaran','Jadwal','Instrumen','Format pengolahan','Berita acara','Format rekomendasi','Format RTL'],
    1, 3, 'Pelatihan penyusunan program penilaian kinerja', 'Susun program penilaian kinerja dengan instrumen dan jadwal yang jelas.'),

  ind('K1','K1.5','Program Pengawasan Semester',
    'Memiliki program pengawasan semester yang operasional dan konsisten dengan Program Pengawasan Tahunan.',
    ['Muda','Madya','Utama'],
    ['Identitas semester dan sasaran','Masalah/kebutuhan prioritas','Kegiatan, target, jadwal, dan output','Keterkaitan dengan program tahunan'],
    ['Program semester ganjil/genap','Matriks kegiatan','Daftar masalah prioritas','Jadwal semester','Target dan output'],
    1, 4, 'Pendampingan penyusunan program semester', 'Susun program semester yang konsisten dengan program tahunan.'),

  ind('K1','K1.6','RPA dan/atau RPM',
    'Memiliki Rencana Pengawasan Akademik dan/atau Rencana Pengawasan Manajerial untuk kegiatan prioritas.',
    ['Muda','Madya','Utama'],
    ['Materi/aspek pengawasan','Tujuan','Indikator keberhasilan','Sasaran','Waktu','Tempat','Strategi/metode','Skenario kegiatan','Instrumen/sumber daya','Rencana tindak lanjut'],
    ['RPA','RPM','Instrumen','Materi','Daftar sasaran','Jadwal'],
    1, 5, 'Workshop penyusunan RPA/RPM', 'Susun RPA/RPM untuk kegiatan prioritas dengan skenario yang jelas.'),
];

// === K2 — PELAKSANAAN PROGRAM PENGAWASAN (Section H) ===
const K2: Indicator[] = [
  ind('K2','K2.1','Pelaksanaan Pembinaan Guru dan/atau Kepala Madrasah',
    'Melaksanakan pembinaan guru dan/atau kepala madrasah sesuai program, sasaran, dan kebutuhan.',
    ['Muda','Madya','Utama'],
    ['Materi','Uraian kegiatan','Sasaran','Target','Metode','Jadwal','Hambatan','Ketercapaian hasil','Kesimpulan dan RTL','Lampiran bukti pelaksanaan'],
    ['Surat tugas','Laporan pembinaan','Daftar hadir','Materi','Instrumen','Rekap hasil','Dokumentasi','Rekomendasi','Bukti tindak lanjut'],
    1, 10, 'Coaching pelaksanaan pembinaan berbasis bukti', 'Laksanakan pembinaan sesuai program dan dokumentasikan bukti pelaksanaan.'),

  ind('K2','K2.2','Pelaksanaan Pemantauan Mutu/SNP',
    'Melaksanakan pemantauan mutu pendidikan dan pemenuhan standar pada madrasah binaan serta menghasilkan rekomendasi.',
    ['Muda','Madya','Utama'],
    ['Standar/aspek yang dipantau','Kegiatan','Madrasah sasaran','Target','Metode','Instrumen terisi','Hambatan','Hasil dan kesenjangan','Rekomendasi/RTL','Lampiran'],
    ['Laporan pemantauan','Instrumen terisi','Data mentah','Rekap hasil','Peta mutu','Rekomendasi','Bukti penyampaian','Dokumentasi'],
    1, 11, 'Bimtek pelaksanaan pemantauan mutu dan analisis kesenjangan', 'Laksanakan pemantauan mutu dan susun rekomendasi berbasis data.'),

  ind('K2','K2.3','Pelaksanaan Penilaian Kinerja Guru dan/atau Kepala Madrasah',
    'Melaksanakan penilaian kinerja guru dan/atau kepala madrasah sesuai kewenangan, prosedur, dan instrumen.',
    ['Muda','Madya','Utama'],
    ['Sasaran','Ruang lingkup','Tahapan','Jadwal','Instrumen','Data hasil pengamatan','Pengolahan','Berita acara','Umpan balik dan rekomendasi','Tindak lanjut'],
    ['Surat tugas','Daftar sasaran','Jadwal','Instrumen terisi','Hasil pengamatan','Rekap nilai','Berita acara','Umpan balik','Rekomendasi','RTL'],
    1, 12, 'Pelatihan pelaksanaan penilaian kinerja dan penyusunan berita acara', 'Laksanakan penilaian kinerja sesuai prosedur dan sampaikan umpan balik.'),

  ind('K2','K2.4','Laporan Tahunan Pelaksanaan Program Pengawasan',
    'Memiliki laporan tahunan pelaksanaan program pengawasan yang sistematis, analitis, dan didukung data.',
    ['Muda','Madya','Utama'],
    ['Identitas laporan','Pendahuluan','Kerangka pikir/permasalahan','Pendekatan dan metode','Hasil seluruh program','Kesimpulan dan rekomendasi','Lampiran'],
    ['Laporan tahunan','Rekap kegiatan','Rekap target dan realisasi','Tabel/grafik','Laporan pembinaan','Laporan pemantauan','Laporan penilaian','Bukti penyampaian laporan'],
    1, 13, 'Workshop penulisan laporan tahunan analitis', 'Susun laporan tahunan dengan analisis target-realisasi dan rekomendasi.'),
];

// === K3 — EVALUASI HASIL PELAKSANAAN PROGRAM PENGAWASAN (Section I) ===
const K3: Indicator[] = [
  ind('K3','K3.1','Evaluasi Hasil Pembinaan',
    'Melaksanakan evaluasi hasil pembinaan guru dan/atau kepala madrasah.',
    ['Muda','Madya','Utama'],
    ['Aspek pembinaan','Kegiatan','Sasaran','Target','Metode evaluasi','Hambatan','Ketercapaian/dampak','Kesimpulan','RTL'],
    ['Laporan evaluasi pembinaan','Data awal dan akhir','Rekap hasil','Analisis perubahan','Rekomendasi','Bukti RTL'],
    1, 20, 'Pelatihan evaluasi dampak pembinaan', 'Laksanakan evaluasi hasil pembinaan dengan data awal-akhir.'),

  ind('K3','K3.2','Evaluasi Hasil Pemantauan Mutu/SNP',
    'Melaksanakan evaluasi hasil pemantauan mutu/SNP dan memetakan kesenjangan madrasah binaan.',
    ['Muda','Madya','Utama'],
    ['Standar/aspek','Kegiatan','Sasaran','Target','Metode','Hambatan','Capaian dan kesenjangan','Kesimpulan','RTL'],
    ['Laporan evaluasi pemantauan','Data hasil','Rekap per madrasah','Analisis kesenjangan','Peta mutu','Rekomendasi','Bukti RTL'],
    1, 21, 'Bimtek evaluasi pemantauan mutu dan pemetaan kesenjangan', 'Susun evaluasi pemantauan dengan peta kesenjangan per madrasah.'),

  ind('K3','K3.3','Evaluasi Hasil Penilaian Kinerja',
    'Melaksanakan evaluasi hasil penilaian kinerja guru dan/atau kepala madrasah untuk memetakan kebutuhan pengembangan kompetensi.',
    ['Muda','Madya','Utama'],
    ['Aspek kinerja','Sasaran','Target','Metode','Rekap hasil','Sebaran capaian','Kekuatan dan kelemahan','Kesimpulan','RTL/PKB'],
    ['Rekap nilai','Analisis hasil','Pemetaan kebutuhan kompetensi','Kesimpulan','Rekomendasi','Program tindak lanjut'],
    1, 22, 'Workshop analisis hasil penilaian kinerja dan pemetaan PKB', 'Laksanakan evaluasi hasil penilaian dan petakan kebutuhan kompetensi.'),

  ind('K3','K3.4','Laporan Evaluasi Keseluruhan Program Pengawasan',
    'Memiliki laporan evaluasi keseluruhan program pengawasan yang memuat analisis target, realisasi, kesenjangan, akar masalah, dan tindak lanjut.',
    ['Muda','Madya','Utama'],
    ['Program yang dievaluasi','Materi/kegiatan','Target','Realisasi','Kesenjangan','Akar masalah','Alternatif solusi dan kesimpulan','RTL/program berikutnya'],
    ['Laporan evaluasi program','Matriks target-realisasi','Analisis kesenjangan','Analisis akar masalah','Alternatif solusi','Rekomendasi','Rancangan program berikutnya'],
    1, 23, 'Pendampingan penyusunan laporan evaluasi program', 'Susun laporan evaluasi dengan analisis akar masalah dan alternatif solusi.'),

  ind('K3','K3.5','Evaluasi Tingkat Kabupaten/Kota atau Provinsi',
    'Melaksanakan evaluasi hasil pengawasan tingkat kabupaten/kota atau provinsi sesuai penugasan.',
    ['Madya','Utama'],
    ['Data agregat wilayah','Analisis antarwilayah/jenjang','Grafik/peta masalah','Rekomendasi kebijakan','Bukti penyampaian'],
    ['Surat tugas','Data agregat','Laporan evaluasi wilayah','Analisis antarwilayah/jenjang','Grafik/peta masalah','Rekomendasi kebijakan','Bukti penyampaian'],
    1, 24, 'Forum koordinasi evaluasi tingkat kabupaten/provinsi', 'Laksanakan evaluasi tingkat wilayah sesuai penugasan resmi.',
    { 0: kriteriaUmum[0], 1: kriteriaUmum[1], 2: kriteriaUmum[2] }),
];

// === K4 — PEMBIMBINGAN DAN PELATIHAN PROFESIONAL (Section J) ===
const K4: Indicator[] = [
  ind('K4','K4.1','Program Pembimbingan dan Pelatihan Profesional',
    'Memiliki program pembimbingan dan pelatihan profesional berdasarkan pemetaan kebutuhan PKB.',
    ['Muda','Madya','Utama'],
    ['Analisis kebutuhan','Materi','Tujuan','Sasaran','Target','Indikator keberhasilan','Jadwal/metode/sumber daya','RTL'],
    ['Analisis kebutuhan PKB','Program pembimbingan','Jadwal','Daftar sasaran','Materi/modul','Instrumen evaluasi','Format RTL'],
    1, 30, 'Workshop penyusunan program PKB berbasis kebutuhan', 'Susun program pembimbingan berdasarkan pemetaan kebutuhan PKB.'),

  ind('K4','K4.2','Pelaksanaan Pembimbingan dan Pelatihan Profesional',
    'Melaksanakan pembimbingan dan pelatihan profesional melalui forum atau kegiatan yang relevan.',
    ['Muda','Madya','Utama'],
    ['Materi','Kegiatan','Sasaran','Target','Metode','Hambatan','Ketercapaian','Produk peserta','Kesimpulan dan RTL','Lampiran'],
    ['Surat tugas/undangan','Laporan','Daftar hadir','Materi','Produk peserta','Instrumen evaluasi','Rekap hasil','Dokumentasi','Bukti tindak lanjut'],
    1, 31, 'Coaching pelaksanaan pembimbingan di forum KKG/MGMP/KKM/Pokjawas', 'Laksanakan pembimbingan melalui forum relevan dan dokumentasikan produk peserta.'),

  ind('K4','K4.3','Pembimbingan Kepala Madrasah dalam Pengelolaan Madrasah',
    'Melaksanakan pembimbingan kepala madrasah dalam kepemimpinan pembelajaran, perencanaan, pengelolaan, evaluasi, dan sistem informasi.',
    ['Madya','Utama'],
    ['Program/laporan pembimbingan','RKM/RKAM yang ditelaah','Instrumen','Produk hasil pembimbingan','Daftar hadir','Evaluasi','RTL'],
    ['Program/laporan pembimbingan','RKM/RKAM atau dokumen perencanaan yang ditelaah','Instrumen','Produk hasil pembimbingan','Daftar hadir','Evaluasi','RTL'],
    1, 32, 'Mentoring pembimbingan pengelolaan madrasah', 'Laksanakan pembimbingan kepala madrasah dengan fokus RKM/RKAM.'),

  ind('K4','K4.4','Evaluasi Hasil Pembimbingan dan Pelatihan',
    'Melaksanakan evaluasi hasil dan dampak kegiatan pembimbingan dan pelatihan profesional.',
    ['Muda','Madya','Utama'],
    ['Program yang dievaluasi','Materi','Target','Hasil','Produk peserta','Kesenjangan','Kesimpulan','RTL'],
    ['Laporan evaluasi','Instrumen evaluasi','Data awal-akhir','Produk peserta','Analisis ketercapaian','Analisis dampak','Rekomendasi','Bukti RTL'],
    1, 33, 'Pelatihan evaluasi dampak pembimbingan dan pelatihan', 'Laksanakan evaluasi dampak pembimbingan dengan data awal-akhir.'),

  ind('K4','K4.5','Pembimbingan Pengawas Lain',
    'Melaksanakan pembimbingan atau mentoring kepada pengawas lain sesuai jenjang dan penugasan.',
    ['Madya','Utama'],
    ['Surat tugas','Program mentoring','Daftar sasaran','Jurnal pembimbingan','Materi','Produk yang diperbaiki','Evaluasi','Rekomendasi'],
    ['Surat tugas','Program mentoring','Daftar sasaran','Jurnal pembimbingan','Materi','Produk yang diperbaiki','Evaluasi','Rekomendasi'],
    1, 34, 'Forum mentoring antar-pengawas', 'Laksanakan mentoring pengawas lain dengan jurnal pembimbingan terdokumentasi.'),

  ind('K4','K4.6','Pembimbingan Penelitian Tindakan/Pengembangan Profesi',
    'Melaksanakan pembimbingan penelitian tindakan, karya tulis, inovasi, atau pengembangan profesi sesuai jenjang dan penugasan.',
    ['Utama'],
    ['Program pembimbingan','Materi','Daftar peserta','Proposal','Instrumen penelitian','Jurnal pembimbingan','Laporan','Artikel/produk publikasi','Evaluasi'],
    ['Program pembimbingan','Materi','Daftar peserta','Proposal','Instrumen penelitian','Jurnal pembimbingan','Laporan','Artikel/produk publikasi','Evaluasi'],
    1, 35, 'Workshop pembimbingan penelitian tindakan dan publikasi', 'Laksanakan pembimbingan penelitian tindakan dengan jurnal dan produk publikasi.'),

  ind('K4','K4.7','Laporan Tahunan Pembimbingan dan Pelatihan',
    'Memiliki laporan tahunan pembimbingan dan pelatihan profesional yang memuat hasil, dampak, dan kebutuhan tindak lanjut.',
    ['Muda','Madya','Utama'],
    ['Identitas laporan','Pendahuluan','Kerangka pikir','Metode','Hasil','Kesimpulan dan rekomendasi','Lampiran'],
    ['Laporan tahunan','Rekap kegiatan','Daftar peserta','Rekap evaluasi','Produk peserta','Analisis dampak','Dokumentasi','Rekomendasi PKB berikutnya'],
    1, 36, 'Pendampingan penyusunan laporan tahunan pembimbingan', 'Susun laporan tahunan pembimbingan dengan analisis dampak.'),
];

export const indicators: Indicator[] = [...K1, ...K2, ...K3, ...K4];

// === BOBOT KOMPONEN (Section K) ===
export const BOBOT_DEFAULT = { K1: 10, K2: 50, K3: 10, K4: 30 };

// === PREDIKAT DEFAULT (Section K) ===
export const PREDIKAT_DEFAULT = [
  { min: 91, label: 'Amat Baik' },
  { min: 76, label: 'Baik' },
  { min: 61, label: 'Cukup' },
  { min: 51, label: 'Sedang' },
  { min: 0, label: 'Kurang' },
];

// === CATATAN OTOMATIS (Section D) ===
export const CATATAN_OTOMATIS: Record<number, string> = {
  0: 'Belum terlaksana atau belum ditemukan bukti yang relevan.',
  1: 'Terlaksana sebagian, tetapi kelengkapan dokumen, analisis, hasil, atau tindak lanjut masih perlu diperbaiki.',
  2: 'Terlaksana secara lengkap dan sesuai; bukti relevan, hasil dapat diverifikasi, dan tindak lanjut tersedia.',
};

export const NA_NOTE = 'Tidak berlaku sesuai jenjang jabatan atau penugasan pengawas.';

// === USERS & SUPERVISORS (unchanged) ===
/** Kode aktivasi lokal (Opsi A). Nanti bisa dipindah ke Supabase tanpa ubah UI. */
export const activationCodes: ActivationCode[] = [
  { id: 'ac-1', code: 'PKPM-POKJAWAS-JEMBER-2026', label: 'Pokjawas Jember 2026', orgId: 'ORG-JEMBER', maxAccounts: 50, active: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'ac-2', code: 'PKPM-DEMO-2026', label: 'Demo', orgId: 'ORG-JEMBER', maxAccounts: 50, active: true, createdAt: '2026-01-01T00:00:00.000Z' },
];

export const users: User[] = Array.from({ length: 8 }, (_, i) => ({
  id: `u${i + 1}`,
  name: i === 0 ? 'Drs. Ahmad Hidayat, M.Pd.' : `Penilai Kabupaten ${i + 1}`,
  username: i === 0 ? 'admin' : `penilai${i + 1}`,
  pinHash: '',
  roles: i === 0 ? ['admin', 'assessor'] : ['assessor'],
  nip: `19700${i + 1}01199003100${i + 1}`,
  active: true,
  failed: 0,
}));

export const supervisors: Supervisor[] = Array.from({ length: 50 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Pengawas Madrasah ${String(i + 1).padStart(2, '0')}`,
  nip: `197${i % 10}0101199${i % 10}031${String(i + 1).padStart(3, '0')}`,
  rank: 'Pembina / IV/a',
  position: 'Pengawas Madrasah',
  level: i % 3 === 0 ? 'Muda' : i % 3 === 1 ? 'Madya' : 'Utama',
  workUnit: 'Kantor Kementerian Agama',
  region: `Wilayah ${i % 10 + 1}`,
  schools: 8 + i % 5,
  principals: 8 + i % 5,
  teachers: 80 + i,
  phone: '081234567890',
  email: `pengawas${i + 1}@example.id`,
  assessorId: `u${i % 8 + 1}`,
  active: true,
}));
