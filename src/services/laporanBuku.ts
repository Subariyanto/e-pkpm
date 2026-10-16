/**
 * Generator Laporan Kepala Kantor / Bahan Laporan Kanwil PKPM.
 *
 * Sistematika dokumen mengikuti urutan berikut:
 *   1. Cover
 *   2. Halaman Pengesahan
 *   3. Kata Pengantar
 *   4. Daftar Isi
 *   5. Bab I Pendahuluan (narasi panjang)
 *   6. Bab II Pelaksanaan (deskripsi pelaksanaan penilaian)
 *   7. Bab III Hasil dan Analisis Penilaian (deskripsi dan analisis lengkap)
 *   8. Bab IV Prioritas PKB (deskripsi + tabel prioritas)
 *   9. Bab V Rekomendasi (narasi)
 *  10. Bab VI Penutup
 *  11. Lampiran: Rekap Hasil (tabel)
 *
 * Nomor halaman dicetak di footer setiap halaman, kecuali cover dan halaman
 * pengesahan. Daftar Isi diisi pada lintasan kedua setelah nomor halaman bab
 * diketahui, memakai doc.setPage() supaya tidak perlu menyisipkan halaman.
 *
 * Semua teks lewat bersih() supaya tidak ada karakter di luar Windows-1252
 * (emoji atau tanda kutip melengkung) yang tampil sebagai petak pada font
 * standar jsPDF.
 */
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { Indicator, Result, Supervisor, Org } from '../types';

type OrgLike = Partial<Org> & { name: string; chairman?: string; headOffice?: string };

export interface BarisRekap {
  no: number;
  nama: string;
  nip: string;
  k1: string;
  k2: string;
  k3: string;
  k4: string;
  akhir: string;
  predikat: string;
}

export interface BarisPrioritas {
  kode: string;
  judul: string;
  rataRata: number;
  jumlahLemah: number;
  rekomendasi: string;
}

export interface OpsiLaporan {
  kind: 'kantor' | 'kanwil';
  org: OrgLike;
  hasil: Result[];
  pengawas: Supervisor[];
  instrumen: Indicator[];
  rekap: BarisRekap[];
  prioritas: BarisPrioritas[];
  /** Jumlah penilai yang terlibat pada periode ini. */
  jumlahPenilai: number;
  /** Catatan kaki tentang sumber data; opsional. */
  catatan?: string;
}

function bersih(v: unknown): string {
  return String(v ?? '').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').replace(/\s+/g, ' ').trim();
}

function tanggalIndo(iso?: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return bersih(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Angka dua desimal gaya Indonesia, mis. 88,94. */
export function angka(v: number) {
  return v.toFixed(2).replace('.', ',');
}

/** Angka satu desimal gaya Indonesia. */
function angka1(v: number) {
  return v.toFixed(1).replace('.', ',');
}

/** Kelas predikat PKPM: Sangat Baik 91-100, Baik 76-90, Cukup 61-75, Kurang <=60. */
export function predikatDari(nilai: number): string {
  if (nilai >= 91) return 'Sangat Baik';
  if (nilai >= 76) return 'Baik';
  if (nilai >= 61) return 'Cukup';
  return 'Kurang';
}

export const NAMA_KOMPONEN: Record<string, { judul: string; bobot: number; ringkas: string }> = {
  K1: {
    judul: 'Penyusunan Program Pengawasan',
    bobot: 10,
    ringkas:
      'penyiapan program pengawasan tahunan, program pembinaan guru dan kepala madrasah, program pemantauan mutu/SNP, program penilaian kinerja, program semester, serta penyusunan RPA dan RPM',
  },
  K2: {
    judul: 'Pelaksanaan Program Pengawasan',
    bobot: 50,
    ringkas:
      'pembinaan dan pelatihan guru, pemantauan mutu/SNP, penilaian kinerja guru dan kepala madrasah, pelaksanaan pengawasan akademik dan manajerial, serta pendampingan pengembangan madrasah',
  },
  K3: {
    judul: 'Evaluasi Hasil Pelaksanaan Program Pengawasan',
    bobot: 10,
    ringkas:
      'evaluasi capaian program, evaluasi pelaksanaan pembinaan dan pelatihan, serta evaluasi hasil pemantauan dan pendampingan pada madrasah binaan',
  },
  K4: {
    judul: 'Pembimbingan dan Pelatihan Profesional',
    bobot: 30,
    ringkas:
      'pembimbingan pengelolaan madrasah, pembimbingan penyusunan perangkat pembelajaran, pembimbingan budaya mutu, pembimbingan publikasi ilmiah, serta pelaksanaan mentoring antar pengawas',
  },
};

interface ElIsi {
  jenis: 'sub' | 'paragraf' | 'poin';
  teks: string;
}

interface Bab {
  no: string;
  judul: string;
  namaDaftar: string;
  isi: ElIsi[];
}

/**
 * Susun seluruh isi bab menjadi struktur data, supaya dapat ditulis dua kali:
 * sekali untuk mencatat nomor halaman dan sekali untuk mencetak ke dokumen.
 * Elemen dengan `sumber` akan diisi nilainya saat render.
 */
function susunBab(ctx: {
  namaOrganisasi: string;
  kabupaten: string;
  kota: string;
  periode: string;
  total: number;
  finalCount: number;
  prosesCount: number;
  jumlahPenilai: number;
  jumlahButir: number;
  rataKabupaten: number;
  tertinggi: number;
  terendah: number;
  predikatKabupaten: string;
  sebaranPredikat: Array<{ predikat: string; jumlah: number }>;
  adaKomponen: boolean;
  komponenRata: Record<string, number>;
  komponenBerbobot: number;
  komponenTerkuat: string;
  komponenTerlemah: string;
  peringkatPengawas: Array<{ nama: string; nilai: number; predikat: string }>;
  adaSangatBaik: boolean;
}): Bab[] {
  const c = ctx;
  return [
    {
      no: 'I',
      judul: 'PENDAHULUAN',
      namaDaftar: 'Pendahuluan',
      isi: [
        { jenis: 'sub', teks: 'A. Latar Belakang' },
        {
          jenis: 'paragraf',
          teks: `Pengawas madrasah memiliki kedudukan strategis dalam menjaga mutu penyelenggaraan pendidikan pada madrasah. Tugas pokok pengawas madrasah meliputi penyusunan program pengawasan, pelaksanaan program pengawasan, evaluasi hasil pelaksanaan program pengawasan, serta pembimbingan dan pelatihan profesional guru dan kepala madrasah. Keempat tugas tersebut tidak berdiri sendiri, melainkan saling terkait dan bertumpu pada data mengenai kondisi nyata madrasah binaan. Karena kedudukan itu, kinerja pengawas madrasah perlu diukur secara sistematis, objektif, dan terdokumentasi agar pembinaan yang diberikan benar-benar menyentuh kebutuhan, bukan sekadar memenuhi kewajiban administratif.`,
        },
        {
          jenis: 'paragraf',
          teks: `Penilaian Kinerja Pengelolaan Kinerja Pengawas Madrasah, yang selanjutnya disingkat PKPM, merupakan instrumen yang disusun untuk mengukur ketercapaian tugas pokok pengawas madrasah secara menyeluruh. PKPM tidak berhenti pada pemberian angka capaian kinerja, tetapi diarahkan pada dua tujuan sekaligus, yaitu menilai dan membina. Melalui penilaian yang jujur dan berbasis bukti, kebutuhan pengembangan kompetensi setiap pengawas dapat dipetakan secara lebih tepat, sehingga program pengembangan keprofesian berkelanjutan yang disusun benar-benar menyasar hal yang paling dibutuhkan dan tidak berulang pada kegiatan yang sama tanpa perbaikan nyata.`,
        },
        {
          jenis: 'paragraf',
          teks: `Pengukuran kinerja pengawas madrasah pada ${c.namaOrganisasi} ${c.kabupaten} periode ${c.periode} dilaksanakan pada empat komponen yang menjadi cerminan tugas pokok pengawas. Keempat komponen itu adalah ${NAMA_KOMPONEN.K1.judul} dengan bobot ${NAMA_KOMPONEN.K1.bobot} persen, ${NAMA_KOMPONEN.K2.judul} dengan bobot ${NAMA_KOMPONEN.K2.bobot} persen, ${NAMA_KOMPONEN.K3.judul} dengan bobot ${NAMA_KOMPONEN.K3.bobot} persen, serta ${NAMA_KOMPONEN.K4.judul} dengan bobot ${NAMA_KOMPONEN.K4.bobot} persen. Bobot terbesar berada pada komponen pelaksanaan program pengawasan karena komponen inilah yang paling langsung bersentuhan dengan guru, kepala madrasah, dan mutu layanan pendidikan pada madrasah binaan.`,
        },
        {
          jenis: 'paragraf',
          teks: `Hasil penilaian tersebut dihimpun menjadi satu laporan yang menyajikan gambaran capaian kinerja pengawas madrasah secara menyeluruh. Laporan ini disusun agar Kepala Kantor Kementerian Agama ${c.kabupaten}, pengelola kepegawaian, serta pemangku kepentingan di lingkungan madrasah memperoleh gambaran yang utuh mengenai capaian kinerja pengawas pada satu periode. Di samping itu, laporan ini menjadi dasar pengambilan kebijakan pembinaan berikutnya, baik yang bersifat individual bagi pengawas tertentu maupun yang bersifat kelompok bagi seluruh pengawas madrasah pada wilayah kerja kantor.`,
        },
        { jenis: 'sub', teks: 'B. Dasar Hukum' },
        {
          jenis: 'paragraf',
          teks: `Penyusunan laporan ini berpijak pada ketentuan yang berlaku mengenai jabatan fungsional pengawas, pengelolaan kinerja pegawai ASN, serta pedoman teknis penilaian kinerja pengawas madrasah pada lingkungan Kementerian Agama. Ruang lingkup penilaian mengacu pada pedoman penilaian kinerja pengawas madrasah dengan nomenklatur yang disesuaikan pada perkembangan terbaru, khususnya yang berkaitan dengan pengelolaan kinerja ASN dan pengembangan keprofesian berkelanjutan. Seluruh dasar hukum yang dirinci pada bagian ini bersifat rujukan resmi dan tidak dimaksudkan untuk menafsirkan peraturan di luar kepentingan penilaian kinerja pengawas madrasah.`,
        },
        { jenis: 'sub', teks: 'C. Maksud dan Tujuan' },
        {
          jenis: 'poin',
          teks: 'Menyajikan hasil pengukuran kinerja pengawas madrasah pada satu periode penilaian secara objektif dan berbasis bukti.',
        },
        {
          jenis: 'poin',
          teks: 'Menggambarkan capaian kinerja pada masing-masing komponen tugas pokok pengawas madrasah beserta sebaran predikatnya.',
        },
        {
          jenis: 'poin',
          teks: 'Mengidentifikasi kekuatan dan kelemahan kinerja pengawas sebagai pijakan pembinaan yang tepat sasaran.',
        },
        {
          jenis: 'poin',
          teks: 'Merumuskan prioritas pengembangan keprofesian berkelanjutan bagi pengawas madrasah di lingkungan kantor.',
        },
        {
          jenis: 'poin',
          teks: 'Menyediakan bahan pertimbangan bagi pimpinan dalam pengambilan kebijakan pembinaan dan penempatan pengawas madrasah.',
        },
        { jenis: 'sub', teks: 'D. Ruang Lingkup' },
        {
          jenis: 'paragraf',
          teks: `Ruang lingkup laporan meliputi pelaksanaan penilaian kinerja terhadap ${c.total} pengawas madrasah yang menjadi sasaran penilaian pada periode ${c.periode}, dengan jumlah penilai yang terlibat sebanyak ${c.jumlahPenilai} orang. Penilaian mencakup seluruh butir instrumen pada empat komponen tugas pokok pengawas madrasah, menggunakan bukti dokumen, klarifikasi, serta pemeriksaan konsistensi antara perencanaan, pelaksanaan, hasil, dan rencana tindak lanjut. Laporan ini tidak membahas aspek kepegawaian lain seperti kenaikan pangkat, mutasi, atau penilaian perilaku kerja yang diatur melalui mekanisme tersendiri.`,
        },
        { jenis: 'sub', teks: 'E. Sistematika Laporan' },
        {
          jenis: 'paragraf',
          teks: 'Laporan ini disusun dengan urutan sebagai berikut. Bab I pendahuluan memuat latar belakang, dasar hukum, maksud dan tujuan, ruang lingkup, serta sistematika. Bab II memuat deskripsi pelaksanaan penilaian beserta tahapan dan metode yang digunakan. Bab III menyajikan hasil dan analisis capaian kinerja pengawas madrasah pada keempat komponen. Bab IV memuat prioritas pengembangan keprofesian berkelanjutan tingkat kabupaten beserta tabelnya. Bab V memuat rekomendasi, Bab VI memuat penutup, dan bagian lampiran memuat rekap hasil pengukuran kinerja dalam bentuk tabel.',
        },
      ],
    },
    {
      no: 'II',
      judul: 'PELAKSANAAN',
      namaDaftar: 'Pelaksanaan',
      isi: [
        { jenis: 'sub', teks: 'A. Waktu dan Tempat Pelaksanaan' },
        {
          jenis: 'paragraf',
          teks: `Pelaksanaan penilaian kinerja pengawas madrasah pada ${c.namaOrganisasi} ${c.kabupaten} berlangsung pada periode tahun ${c.periode}. Penilaian dilaksanakan melalui penelaahan dokumen dan klarifikasi terhadap pengawas madrasah yang menjadi sasaran, dengan sumber data utama berupa dokumen perencanaan, dokumen pelaksanaan pengawasan, laporan hasil, serta bukti tindak lanjut yang diarsipkan masing-masing pengawas. Pelaksanaan penilaian dilakukan di lingkungan kerja ${c.namaOrganisasi} dan madrasah binaan, sesuai dengan jadwal yang ditetapkan oleh tim penilai agar tidak mengganggu pelaksanaan tugas pengawasan rutin.`,
        },
        { jenis: 'sub', teks: 'B. Sasaran Penilaian' },
        {
          jenis: 'paragraf',
          teks: `Sasaran penilaian pada periode ini berjumlah ${c.total} pengawas madrasah dengan status hasil sebanyak ${c.finalCount} hasil berstatus final dan ${c.prosesCount} hasil masih dalam proses penyelesaian. Sasaran penilaian terdiri atas pengawas dengan jenjang jabatan yang berbeda, sehingga butir instrumen yang diberlakukan pada masing-masing pengawas menyesuaikan jenjang jabatannya. Setiap pengawas dinilai oleh satu penilai yang ditetapkan oleh pihak kantor, dan pengawas dilarang menilai dirinya sendiri agar hasil penilaian tetap bebas dari kepentingan pribadi.`,
        },
        { jenis: 'sub', teks: 'C. Penilai dan Mekanisme' },
        {
          jenis: 'paragraf',
          teks: `Penilaian pada periode ini melibatkan ${c.jumlahPenilai} penilai yang berasal dari pengawas madrasah dengan jenjang jabatan yang setara atau lebih tinggi. Mekanisme penilaian yang digunakan adalah penilaian individual, yaitu setiap sasaran dinilai secara mandiri oleh penilai yang ditetapkan. Penilai tidak melakukan penilaian atas dirinya sendiri, dan hasil penilaian tidak dibandingkan secara langsung antar pengawas, melainkan dinilai terhadap kriteria rubrik yang telah ditetapkan pada setiap butir instrumen. Cara ini dipilih agar hasil penilaian mencerminkan ketercapaian butir secara apa adanya, bukan hasil perbandingan antar individu.`,
        },
        { jenis: 'sub', teks: 'D. Tahapan Pelaksanaan' },
        {
          jenis: 'paragraf',
          teks: 'Pelaksanaan penilaian kinerja pengawas madrasah dilaksanakan melalui tahapan berikut, agar hasil yang diperoleh dapat dipertanggungjawabkan secara prosedural maupun substansial.',
        },
        {
          jenis: 'poin',
          teks: 'Persiapan. Tim penilai menghimpun data sasaran, memastikan instrumen yang berlaku sudah tersedia pada aplikasi, dan menetapkan penilai bagi setiap pengawas. Instrumen disesuaikan dengan jenjang jabatan masing-masing pengawas.',
        },
        {
          jenis: 'poin',
          teks: 'Pengumpulan bukti. Setiap pengawas menyiapkan dokumen perencanaan program pengawasan, bukti pelaksanaan pengawasan pada madrasah binaan, dokumen hasil evaluasi, serta bukti pembimbingan dan pelatihan profesional yang dilaksanakan.',
        },
        {
          jenis: 'poin',
          teks: 'Penggalian data. Penilai menelaah setiap butir instrumen, mencatat dokumen yang ditemukan, memberikan kunci skor, serta menuliskan catatan pada butir yang skornya rendah sebagai dasar pembinaan.',
        },
        {
          jenis: 'poin',
          teks: 'Penetapan skor. Penilai menetapkan skor pada setiap butir dengan rentang nol sampai dua berdasarkan rubrik kriteria yang tersedia. Butir yang tidak berlaku pada jenjang pengawas dapat ditandai tidak berlaku dengan alasan yang jelas.',
        },
        {
          jenis: 'poin',
          teks: 'Penyusunan catatan hasil dan rencana tindak lanjut. Setelah seluruh butir dinilai, sistem menyusun catatan hasil penilaian dan rencana tindak lanjut secara otomatis berdasarkan sebaran skor seluruh komponen.',
        },
        {
          jenis: 'poin',
          teks: 'Finalisasi dan pelaporan. Hasil yang telah lengkap difinalisasi, kemudian dihimpun menjadi laporan tingkat kabupaten beserta prioritas pengembangan keprofesian berkelanjutan.',
        },
        { jenis: 'sub', teks: 'E. Metode dan Instrumen Penilaian' },
        {
          jenis: 'paragraf',
          teks: 'Metode yang digunakan dalam penggalian data meliputi telaah dokumen, wawancara atau klarifikasi kepada pengawas dan pihak madrasah binaan, konfirmasi kepada madrasah binaan, serta pemeriksaan konsistensi antara program, pelaksanaan, hasil, dan rencana tindak lanjut. Kombinasi metode ini dipilih agar penilai memperoleh gambaran yang tidak hanya bersandar pada keberadaan dokumen, tetapi juga pada keterlaksanaan kegiatan dan keterhubungan antar dokumen.',
        },
        {
          jenis: 'paragraf',
          teks: `Instrumen yang digunakan memuat ${c.jumlahButir} butir yang tersebar pada empat komponen. Setiap butir memiliki aspek yang harus dipenuhi, daftar dokumen yang ditelaah, rubrik kriteria untuk skor nol, satu, dan dua, serta rekomendasi pengembangan keprofesian yang dapat dijadikan acuan pembinaan. Skor nol diberikan apabila kegiatan tidak dilaksanakan atau aspek yang terpenuhi kurang dari empat puluh persen, skor satu diberikan apabila kegiatan terlaksana sebagian dengan aspek terpenuhi sekitar empat puluh sampai kurang dari delapan puluh persen, dan skor dua diberikan apabila kegiatan terlaksana dengan dokumen lengkap serta sekurang-kurangnya delapan puluh persen aspek terpenuhi.`,
        },
        { jenis: 'sub', teks: 'F. Kendala dan Upaya Penanganan' },
        {
          jenis: 'paragraf',
          teks: 'Dalam pelaksanaan penilaian, tim penilai menghadapi beberapa kendala antara lain kelengkapan arsip dokumen yang belum seragam antar pengawas, keterbatasan waktu penelaahan pada akhir periode, serta perbedaan penafsiran terhadap sebagian aspek butir instrumen. Untuk mengatasi hal tersebut dilakukan klarifikasi langsung kepada pengawas yang bersangkutan, penyeragaman pemahaman rubrik melalui diskusi tim penilai, serta pendampingan teknis penggunaan aplikasi sehingga pengisian instrumen berjalan lebih tertib dan hasil yang diperoleh lebih dapat dipercaya.',
        },
      ],
    },
    {
      no: 'III',
      judul: 'HASIL DAN ANALISIS PENILAIAN',
      namaDaftar: 'Hasil dan Analisis Penilaian',
      isi: [
        { jenis: 'sub', teks: 'A. Gambaran Umum Hasil' },
        {
          jenis: 'paragraf',
          teks: `Hasil penilaian kinerja pengawas madrasah pada ${c.namaOrganisasi} ${c.kabupaten} periode ${c.periode} menunjukkan rata-rata nilai akhir kabupaten sebesar ${angka(c.rataKabupaten)} dengan predikat ${c.predikatKabupaten}. Nilai tertinggi yang diperoleh pengawas adalah ${angka(c.tertinggi)}, sedangkan nilai terendah adalah ${angka(c.terendah)}. Dari ${c.total} hasil penilaian yang terhimpun, sebanyak ${c.finalCount} hasil telah berstatus final dan ${c.prosesCount} hasil masih dalam proses penyelesaian. Berdasarkan kelas predikat yang berlaku, distribusi hasil tergambar pada uraian berikut.`,
        },
        ...c.sebaranPredikat.map((s) => ({
          jenis: 'poin' as const,
          teks: `${s.predikat}: ${s.jumlah} pengawas${c.total ? ` (${angka1((s.jumlah / c.total) * 100)} persen)` : ''}.`,
        })),
        {
          jenis: 'paragraf',
          teks: c.adaSangatBaik
            ? 'Sebaran tersebut memperlihatkan bahwa capaian kinerja pengawas madrasah secara umum berada pada kategori baik, dengan sebagian pengawas telah mencapai kategori sangat baik. Kondisi ini menandakan bahwa pelaksanaan tugas pokok pengawasan sudah berjalan sistematis, meskipun masih terdapat ruang perbaikan pada aspek-aspek tertentu yang perlu diintervensi melalui program pembinaan yang terarah.'
            : 'Sebaran tersebut memperlihatkan bahwa capaian kinerja pengawas madrasah secara umum berada pada kategori baik, meskipun belum ada pengawas yang mencapai kategori sangat baik. Kondisi ini menandakan bahwa pelaksanaan tugas pokok pengawasan sudah berjalan sistematis, namun masih terdapat ruang perbaikan yang cukup luas pada sejumlah aspek, sehingga pembinaan perlu diarahkan pada penguatan kualitas bukti dan ketuntasan tindak lanjut.',
        },
        { jenis: 'sub', teks: 'B. Analisis Capaian per Komponen' },
        {
          jenis: 'paragraf',
          teks: c.adaKomponen
            ? `Analisis capaian per komponen dilakukan dengan menggunakan bobot sebagaimana ditetapkan pada pedoman penilaian kinerja pengawas madrasah. Rata-rata capaian masing-masing komponen beserta bobotnya adalah sebagai berikut: ${NAMA_KOMPONEN.K1.judul} memperoleh rata-rata ${angka(c.komponenRata.K1)} dengan bobot ${NAMA_KOMPONEN.K1.bobot} persen; ${NAMA_KOMPONEN.K2.judul} memperoleh rata-rata ${angka(c.komponenRata.K2)} dengan bobot ${NAMA_KOMPONEN.K2.bobot} persen; ${NAMA_KOMPONEN.K3.judul} memperoleh rata-rata ${angka(c.komponenRata.K3)} dengan bobot ${NAMA_KOMPONEN.K3.bobot} persen; dan ${NAMA_KOMPONEN.K4.judul} memperoleh rata-rata ${angka(c.komponenRata.K4)} dengan bobot ${NAMA_KOMPONEN.K4.bobot} persen.`
            : 'Analisis capaian per komponen belum dapat disajikan secara lengkap karena data skor komponen pada hasil yang tersimpan belum terisi. Data yang tersedia baru berupa nilai akhir setiap pengawas, sehingga analisis pada bagian ini bersifat umum.',
        },
        ...(c.adaKomponen
          ? [
              {
                jenis: 'paragraf' as const,
                teks:
                  c.komponenRata[c.komponenTerkuat] > 0
                    ? `Komponen ${c.komponenTerkuat} (${NAMA_KOMPONEN[c.komponenTerkuat].judul}) menunjukkan capaian paling tinggi dengan rata-rata ${angka(c.komponenRata[c.komponenTerkuat])}. Capaian ini menggambarkan bahwa aspek ${NAMA_KOMPONEN[c.komponenTerkuat].ringkas} secara umum telah dilaksanakan dengan bukti yang memadai. Sebaliknya, komponen ${c.komponenTerlemah} (${NAMA_KOMPONEN[c.komponenTerlemah].judul}) menunjukkan capaian paling rendah dengan rata-rata ${angka(c.komponenRata[c.komponenTerlemah])}, sehingga menjadi perhatian utama dalam pembinaan periode berikutnya. Perbedaan capaian antar komponen menjadi petunjuk bahwa kekuatan pengawas madrasah pada ${c.kabupaten} terletak pada ${NAMA_KOMPONEN[c.komponenTerkuat].ringkas}, sedangkan penguatan paling mendesak berada pada ${NAMA_KOMPONEN[c.komponenTerlemah].ringkas}.`
                    : 'Capaian pada seluruh komponen tercatat pada kisaran yang sebanding, sehingga belum tampak perbedaan yang mencolok antar komponen. Kondisi ini menuntut pembinaan yang merata pada keempat komponen tugas pokok pengawas madrasah agar capaian dapat meningkat secara menyeluruh.',
              },
              {
                jenis: 'paragraf' as const,
                teks: `Apabila dilakukan pembobotan, kombinasi capaian keempat komponen menghasilkan angka ${angka(c.komponenBerbobot)} yang sejalan dengan rata-rata nilai akhir kabupaten sebesar ${angka(c.rataKabupaten)}. Kesesuaian angka ini menegaskan bahwa nilai akhir yang diperoleh setiap pengawas merupakan hasil akumulasi capaian butir yang konsisten dengan bobot komponen, bukan hasil pengisian pada satu komponen saja. Dengan demikian, penguatan pada komponen dengan bobot terbesar, yaitu pelaksanaan program pengawasan, akan memberikan pengaruh paling besar terhadap peningkatan nilai akhir pengawas madrasah secara keseluruhan.`,
              },
            ]
          : []),
        { jenis: 'sub', teks: 'C. Peringkat dan Sebaran Nilai' },
        {
          jenis: 'paragraf',
          teks: c.peringkatPengawas.length
            ? `Urutan capaian nilai akhir pengawas madrasah pada periode ini adalah sebagai berikut: ${c.peringkatPengawas
                .map((p, i) => `${i + 1}) ${p.nama} dengan nilai ${angka(p.nilai)} dan predikat ${p.predikat}`)
                .join('; ')}. Sebaran nilai tersebut menunjukkan rentang capaian sebesar ${angka(c.tertinggi - c.terendah)} poin antara nilai tertinggi dan terendah. Rentang tersebut perlu dibaca sebagai kebutuhan pembinaan yang berbeda antar pengawas, bukan sebagai dasar perbandingan antar individu, karena setiap pengawas memiliki wilayah binaan, jumlah madrasah, dan karakteristik tugas yang tidak sepenuhnya sama.`
            : 'Belum ada data nilai akhir yang dapat diurutkan pada periode ini.',
        },
        { jenis: 'sub', teks: 'D. Kekuatan' },
        {
          jenis: 'paragraf',
          teks: `Kekuatan kinerja pengawas madrasah pada periode ${c.periode} tampak pada komponen yang capaiannya relatif tinggi, yaitu ${NAMA_KOMPONEN[c.komponenTerkuat]?.judul || 'komponen dengan capaian tertinggi'}. Aspek ${NAMA_KOMPONEN[c.komponenTerkuat]?.ringkas || 'yang tergolong dalam komponen tersebut'} telah terdokumentasi dengan cukup baik dan menunjukkan keterlaksanaan kegiatan yang konsisten. Kekuatan ini penting untuk dipertahankan, bahkan dijadikan contoh praktik baik bagi pengawas lain, sehingga tidak terkikis oleh upaya perbaikan pada aspek yang masih lemah. Selain itu, capaian kabupaten sebesar ${angka(c.rataKabupaten)} dengan predikat ${c.predikatKabupaten} menunjukkan bahwa standar pelaksanaan tugas pokok pengawasan sudah dapat dipenuhi pada kondisi tertentu.`,
        },
        { jenis: 'sub', teks: 'E. Kelemahan dan Tantangan' },
        {
          jenis: 'paragraf',
          teks: `Kelemahan yang paling tampak terletak pada komponen ${c.komponenTerlemah} (${NAMA_KOMPONEN[c.komponenTerlemah]?.judul || 'komponen dengan capaian terendah'}) dengan rata-rata ${angka(c.komponenRata[c.komponenTerlemah] || 0)}. Kelemahan pada komponen ini umumnya berkaitan dengan kelengkapan bukti dukung, ketuntasan analisis, serta ketidakjelasan tindak lanjut atas temuan pengawasan. Pada beberapa butir, dokumen perencanaan tersedia namun tidak diikuti bukti pelaksanaan yang memadai, sehingga keterhubungan antara program, pelaksanaan, dan hasil belum dapat ditelusuri sepenuhnya. Tantangan berikutnya adalah menjaga konsistensi penamaan, penomoran, dan pengarsipan dokumen agar penelaahan pada periode berikutnya berlangsung lebih cepat dan hasilnya lebih objektif.`,
        },
        { jenis: 'sub', teks: 'F. Faktor yang Memengaruhi Capaian' },
        {
          jenis: 'paragraf',
          teks: 'Capaian kinerja pengawas madrasah dipengaruhi oleh beberapa faktor. Faktor pertama adalah ketersediaan dan ketertiban arsip dokumen, karena penilaian berbasis bukti tidak dapat menjangkau kegiatan yang tidak terdokumentasi meskipun kegiatan tersebut sesungguhnya telah dilaksanakan. Faktor kedua adalah sebaran wilayah binaan, sebab jumlah madrasah yang dibina dan jarak tempuh berpengaruh terhadap intensitas kunjungan dan pendampingan. Faktor ketiga adalah pemahaman terhadap rubrik penilaian, karena penafsiran yang berbeda atas satu butir dapat menghasilkan skor yang berbeda. Faktor keempat adalah kesempatan pengembangan kompetensi yang pernah diikuti pengawas, karena pengalaman mengikuti pelatihan, bimbingan teknis, maupun kegiatan berbagi praktik baik berpengaruh pada mutu dokumen dan kualitas pendampingan yang dilakukan.',
        },
      ],
    },
    {
      no: 'IV',
      judul: 'PRIORITAS PKB',
      namaDaftar: 'Prioritas PKB',
      isi: [
        { jenis: 'sub', teks: 'A. Dasar Penyusunan Prioritas' },
        {
          jenis: 'paragraf',
          teks: `Prioritas pengembangan keprofesian berkelanjutan pada tingkat kabupaten disusun dari rata-rata capaian setiap butir instrumen yang telah dinilai pada seluruh pengawas. Butir dengan rata-rata skor terendah dipandang sebagai kebutuhan pengembangan yang paling mendesak, karena pada butir tersebut secara umum belum terpenuhi aspek yang dipersyaratkan. Pendekatan ini dipilih agar program pengembangan keprofesian berkelanjutan bertumpu pada data capaian nyata, bukan pada perkiraan atau kebiasaan yang berlangsung dari tahun ke tahun.`,
        },
        {
          jenis: 'paragraf',
          teks: 'Penyusunan prioritas juga mempertimbangkan keberadaan pengawas yang memperoleh skor rendah pada butir tertentu. Butir yang memiliki rata-rata rendah sekaligus dikuatkan oleh sejumlah pengawas dengan skor rendah dipandang lebih mendesak untuk ditangani daripada butir yang rata-ratanya rendah karena hanya satu atau dua pengawas yang belum melengkapinya. Dengan cara ini, pengembangan keprofesian berkelanjutan dapat dirancang sebagai kegiatan bersama bagi kelompok pengawas, sekaligus pendampingan individual bagi pengawas yang memerlukan.',
        },
        { jenis: 'sub', teks: 'B. Tabel Prioritas PKB Kabupaten' },
        {
          jenis: 'paragraf',
          teks: 'Berdasarkan perhitungan tersebut, lima prioritas pengembangan keprofesian berkelanjutan tingkat kabupaten beserta rekomendasi kegiatannya disajikan pada tabel berikut.',
        },
        { jenis: 'sub', teks: 'C. Rencana Pelaksanaan' },
        {
          jenis: 'paragraf',
          teks: 'Pelaksanaan pengembangan keprofesian berkelanjutan atas prioritas di atas diarahkan pada bentuk kegiatan yang aplikatif dan dapat langsung memperbaiki bukti kinerja. Untuk kebutuhan penguatan penyusunan program, kegiatan yang relevan berupa lokakarya atau bimbingan teknis penyusunan program pengawasan berbasis data hasil evaluasi dan kebutuhan madrasah binaan. Untuk kebutuhan penguatan pelaksanaan, kegiatan yang relevan berupa pendampingan langsung dan berbagi praktik baik antar pengawas, dengan pengawas yang capaiannya lebih tinggi bertindak sebagai pendamping. Untuk kebutuhan penguatan evaluasi dan tindak lanjut, kegiatan dapat berbentuk workshop penyusunan instrumen evaluasi serta pelaporan hasil pengawasan yang disertai analisis dan rencana tindak lanjut.',
        },
        {
          jenis: 'paragraf',
          teks: 'Pelaksanaan kegiatan tersebut sebaiknya dijadwalkan pada awal periode agar hasilnya dapat langsung digunakan dalam penyusunan program pengawasan tahun berikutnya. Setiap kegiatan perlu disertai produk yang terukur, misalnya dokumen program yang telah diperbaiki, instrumen pendampingan yang siap digunakan, atau laporan hasil evaluasi yang lengkap dengan analisis dan tindak lanjut. Keberadaan produk tersebut memudahkan penilaian kemajuan sekaligus memperkuat bukti kinerja pengawas pada periode berikutnya.',
        },
      ],
    },
    {
      no: 'V',
      judul: 'REKOMENDASI',
      namaDaftar: 'Rekomendasi',
      isi: [
        {
          jenis: 'paragraf',
          teks: `Berdasarkan hasil dan analisis yang disajikan pada bab sebelumnya, beberapa rekomendasi berikut diajukan sebagai bahan tindak lanjut bagi Kepala Kantor Kementerian Agama ${c.kabupaten}, ${c.namaOrganisasi}, dan para pengawas madrasah.`,
        },
        { jenis: 'sub', teks: 'A. Bagi Kepala Kantor Kementerian Agama' },
        {
          jenis: 'paragraf',
          teks: `Disarankan agar hasil penilaian kinerja pengawas madrasah ini dijadikan dasar dalam penyusunan program pembinaan pengawas pada tahun berikutnya, termasuk penetapan kegiatan pengembangan keprofesian berkelanjutan yang disesuaikan dengan prioritas kabupaten. Selain itu, diperlukan dukungan sumber daya berupa penyediaan kesempatan mengikuti pelatihan, bimbingan teknis, serta fasilitasi pertemuan berkala antar pengawas agar praktik baik dapat tersebar lebih cepat dan merata. Dukungan juga diperlukan dalam hal penertiban administrasi, khususnya penyediaan format baku dokumen pengawasan dan sistem pengarsipan yang memudahkan penelaahan bukti.`,
        },
        { jenis: 'sub', teks: 'B. Bagi Pengawas Madrasah' },
        {
          jenis: 'paragraf',
          teks: 'Setiap pengawas madrasah disarankan menindaklanjuti catatan hasil penilaian pada butir yang masih memperoleh skor rendah dengan melengkapi bukti dukung, memperjelas analisis, dan memastikan adanya rencana tindak lanjut atas setiap temuan. Kegiatan pengawasan sebaiknya direncanakan dan didokumentasikan sejak awal periode, sehingga pada saat penilaian seluruh rangkaian program, pelaksanaan, hasil, dan tindak lanjut dapat ditelusuri dengan jelas. Pengawas yang telah memperoleh capaian tinggi diharapkan berbagi pengalaman sebagai mentor bagi rekan sejawat, terutama pada aspek penyusunan program dan pendampingan madrasah.',
        },
        { jenis: 'sub', teks: 'C. Bagi Pokjawas dan Tim Penilai' },
        {
          jenis: 'paragraf',
          teks: 'Disarankan agar penetapan penilai dilakukan lebih awal pada setiap periode, disertai pemeriksaan instrumen sebelum penilaian dimulai sehingga butir yang berlaku pada masing-masing jenjang sudah dipastikan tersedia. Penyamaan persepsi terhadap rubrik perlu dilakukan pada pertemuan awal tim penilai, agar perbedaan penafsiran antar penilai dapat ditekan. Tim penilai juga disarankan mendokumentasikan kendala dan usulan perbaikan instrumen pada setiap periode, sehingga instrumen dan pedoman penilaian dapat diperbaiki secara berkelanjutan.',
        },
        { jenis: 'sub', teks: 'D. Bagi Madrasah Binaan' },
        {
          jenis: 'paragraf',
          teks: 'Madrasah binaan diharapkan mendukung pelaksanaan tugas pengawas dengan menyediakan data, dokumen, dan keterangan yang diperlukan pada saat pemantauan maupun klarifikasi. Keterbukaan madrasah atas temuan pengawasan akan mempercepat perbaikan mutu, karena tindak lanjut yang baik hanya dapat disusun apabila kondisi nyata madrasah tercatat dengan jujur dan lengkap.',
        },
      ],
    },
    {
      no: 'VI',
      judul: 'PENUTUP',
      namaDaftar: 'Penutup',
      isi: [
        {
          jenis: 'paragraf',
          teks: `Laporan hasil penilaian kinerja pengelolaan kinerja pengawas madrasah ${c.namaOrganisasi} ${c.kabupaten} periode ${c.periode} ini menyajikan gambaran capaian kinerja yang secara umum berada pada kategori ${c.predikatKabupaten} dengan rata-rata nilai akhir ${angka(c.rataKabupaten)}. Hasil tersebut menunjukkan bahwa pelaksanaan tugas pokok pengawasan telah berjalan sesuai ketentuan, meskipun masih menyisakan aspek yang memerlukan penguatan, terutama pada komponen ${NAMA_KOMPONEN[c.komponenTerlemah]?.judul || 'yang capaiannya paling rendah'}.`,
        },
        {
          jenis: 'paragraf',
          teks: 'Penilaian kinerja pada hakikatnya bukan tujuan akhir, melainkan pintu masuk bagi pembinaan yang lebih tepat sasaran. Karena itu, hasil penilaian ini sebaiknya dibaca sebagai peta kebutuhan pengembangan, bukan semata sebagai laporan capaian angka. Prioritas pengembangan keprofesian berkelanjutan yang telah dirumuskan pada bab sebelumnya diharapkan dapat ditindaklanjuti secara terencana dan berkelanjutan, dengan penjadwalan yang jelas dan produk kegiatan yang terukur.',
        },
        {
          jenis: 'paragraf',
          teks: `Kami menyampaikan terima kasih kepada semua pihak yang telah mendukung pelaksanaan penilaian dan penyusunan laporan ini. Semoga laporan ini bermanfaat bagi peningkatan mutu pengawasan madrasah, pengembangan kompetensi pengawas madrasah, serta peningkatan mutu layanan pendidikan pada madrasah binaan di lingkungan Kantor Kementerian Agama ${c.kabupaten}.`,
        },
      ],
    },
  ];
}

/**
 * Bangun berkas PDF laporan berbab lengkap.
 *
 * @returns Blob PDF siap dicetak atau disimpan
 */
export async function generateBukuLaporan(opsi: OpsiLaporan): Promise<Blob> {
  const { kind, org, hasil, pengawas, instrumen, rekap, prioritas, jumlahPenilai } = opsi;
  const judul = kind === 'kantor' ? 'LAPORAN HASIL PENILAIAN KINERJA' : 'BAHAN LAPORAN PENILAIAN KINERJA';
  const subjudul = kind === 'kantor'
    ? 'PENGELOLAAN KINERJA PENGAWAS MADRASAH (PKPM)'
    : 'PENGELOLAAN KINERJA PENGAWAS MADRASAH (PKPM) UNTUK KANWIL';
  const periode = bersih(org.period) || String(new Date().getFullYear());
  const kabupaten = bersih(org.district) || 'Kabupaten Jember';
  const kota = kabupaten.replace(/^kabupaten\s+/i, '') || 'Jember';
  const namaOrganisasi = bersih(org.name) || 'Pokjawas Madrasah';
  const namaKetua = bersih(org.chairman) || '_________________________';
  const namaKantor = bersih(org.headOffice) || '_________________________';
  const nipKetua = bersih((org as Record<string, unknown>).nipChairman as string) || '..............................';
  const nipKantor = bersih((org as Record<string, unknown>).nipHeadOffice as string) || '..............................';
  const hariIni = tanggalIndo(new Date().toISOString());

  const nilaiAkhir = (r: Result) => Number(r.finalScore) || 0;
  const rata = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const total = hasil.length;
  const finalCount = hasil.filter((r) => r.status === 'final').length;
  const prosesCount = total - finalCount;
  const rataKabupaten = rata(hasil.map(nilaiAkhir));
  const nilaiArr = hasil.map(nilaiAkhir);
  const tertinggi = nilaiArr.length ? Math.max(...nilaiArr) : 0;
  const terendah = nilaiArr.length ? Math.min(...nilaiArr) : 0;
  const predikatKabupaten = predikatDari(rataKabupaten);

  const adaKomponen = hasil.some((r) => r.componentScores && Object.keys(r.componentScores).length);
  const komponenRata: Record<string, number> = {};
  for (const k of ['K1', 'K2', 'K3', 'K4']) {
    komponenRata[k] = adaKomponen ? rata(hasil.map((r) => Number(r.componentScores?.[k]) || 0)) : 0;
  }
  const komponenBerbobot = ['K1', 'K2', 'K3', 'K4'].reduce(
    (a, k) => a + komponenRata[k] * (NAMA_KOMPONEN[k].bobot / 100),
    0,
  );
  const komponenTerkuat = ['K1', 'K2', 'K3', 'K4'].sort((a, b) => komponenRata[b] - komponenRata[a])[0];
  const komponenTerlemah = ['K1', 'K2', 'K3', 'K4'].sort((a, b) => komponenRata[a] - komponenRata[b])[0];

  const peringkatPengawas = [...hasil]
    .sort((a, b) => nilaiAkhir(b) - nilaiAkhir(a))
    .map((r) => ({
      nama: bersih(pengawas.find((p) => p.id === r.supervisorId)?.name) || '-',
      nilai: nilaiAkhir(r),
      predikat: bersih(r.predicate) || predikatDari(nilaiAkhir(r)),
    }));

  const sebaranPredikat = ['Sangat Baik', 'Baik', 'Cukup', 'Kurang'].map((p) => ({
    predikat: p,
    jumlah: hasil.filter((r) => (bersih(r.predicate) || predikatDari(nilaiAkhir(r))) === p).length,
  }));

  const petaIndikator = new Map(instrumen.map((i) => [i.code, i]));
  const prioritasLengkap: BarisPrioritas[] = prioritas.map((p) => {
    const ind = petaIndikator.get(p.kode);
    return { ...p, judul: p.judul || bersih(ind?.title || ind?.description) || '-' };
  });

  const catatanSumber =
    opsi.catatan ||
    'Data laporan ini diambil langsung dari basis data e-PKPM pada perangkat yang digunakan, sehingga angka yang tersaji bersifat mutakhir pada saat pencetakan.';

  const babData = susunBab({
    namaOrganisasi,
    kabupaten,
    kota,
    periode,
    total,
    finalCount,
    prosesCount,
    jumlahPenilai,
    jumlahButir: instrumen.length,
    rataKabupaten,
    tertinggi,
    terendah,
    predikatKabupaten,
    sebaranPredikat,
    adaKomponen,
    komponenRata,
    komponenBerbobot,
    komponenTerkuat,
    komponenTerlemah,
    peringkatPengawas,
    adaSangatBaik: sebaranPredikat.some((s) => s.predikat === 'Sangat Baik' && s.jumlah > 0),
  });

  // ---- Dokumen -------------------------------------------------------------
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 22;
  const LEBAR = 166;
  const KIRI = 18;
  const LEBAR_TABEL = 174;
  const BAWAH = 272;
  const ATAS = 24;

  doc.setProperties({
    title: `${judul} ${namaOrganisasi} ${periode}`,
    subject: `Laporan PKPM ${kabupaten} periode ${periode}`,
    author: namaKetua,
    creator: 'e-PKPM',
  });

  const halamanBaru = (y = ATAS) => {
    doc.addPage();
    return y;
  };

  const periksaRuang = (y: number, butuh: number) => (y + butuh > BAWAH ? halamanBaru() : y);

  // ===== 1. COVER ===========================================================
  let y = 34;
  doc.setTextColor(23, 63, 112);
  doc.setDrawColor(23, 63, 112);
  doc.setLineWidth(0.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA', 105, y, { align: 'center' });
  y += 6;
  doc.setFontSize(12);
  doc.text(`KANTOR KEMENTERIAN AGAMA ${kabupaten.toUpperCase()}`, 105, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${namaOrganisasi} · ${bersih(org.province) || 'Jawa Timur'}`, 105, y, { align: 'center' });
  y += 6;
  doc.setLineWidth(0.8);
  doc.line(M, y, 210 - M, y);
  y += 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(judul, 105, y, { align: 'center' });
  y += 8;
  doc.setFontSize(12);
  doc.text(subjudul, 105, y, { align: 'center' });
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Periode ${periode}`, 105, y, { align: 'center' });
  y += 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Disusun oleh:', 105, y, { align: 'center' });
  y += 7;
  doc.setFontSize(13);
  doc.text(namaOrganisasi.toUpperCase(), 105, y, { align: 'center' });
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${kabupaten}, ${bersih(org.province) || 'Jawa Timur'}`, 105, y, { align: 'center' });
  y += 40;

  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text(bersih(org.address) || '-', 105, y, { align: 'center' });
  y += 5;
  doc.text(bersih(org.email) || '-', 105, y, { align: 'center' });
  y += 5;
  doc.text(bersih(org.phone) || '-', 105, y, { align: 'center' });

  doc.setTextColor(23, 63, 112);
  doc.setLineWidth(0.8);
  doc.line(M, 262, 210 - M, 262);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(23, 63, 112);
  doc.text(periode, 105, 270, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // ===== 2. HALAMAN PENGESAHAN =============================================
  doc.addPage();
  y = 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('HALAMAN PENGESAHAN', 105, y, { align: 'center' });
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  y = tulisParagraf(
    doc,
    `Laporan Hasil Penilaian Kinerja Pengelolaan Kinerja Pengawas Madrasah (PKPM) ${namaOrganisasi} ${kabupaten} periode ${periode} ini disusun sebagai bentuk pertanggungjawaban pelaksanaan penilaian kinerja pengawas madrasah. Laporan memuat hasil penilaian ${total} pengawas pada empat komponen penilaian, yaitu ${NAMA_KOMPONEN.K1.judul}, ${NAMA_KOMPONEN.K2.judul}, ${NAMA_KOMPONEN.K3.judul}, dan ${NAMA_KOMPONEN.K4.judul}, beserta analisis capaian dan prioritas pengembangan keprofesian berkelanjutan.`,
    M, y, LEBAR,
  );
  y += 8;
  y = tulisParagraf(
    doc,
    `Laporan ini telah diperiksa dan disahkan untuk digunakan sebagaimana mestinya, baik sebagai bahan pembinaan pengawas madrasah, bahan penyusunan program pengawasan tahun berikutnya, maupun sebagai bahan pelaporan kepada Kepala Kantor Kementerian Agama ${kabupaten}.`,
    M, y, LEBAR,
  );
  y += 14;

  // Dua kolom tanda tangan, digeser ke kanan sampai lurus dengan batas
  // paragraf: kolom kiri mulai di margin kiri (M) dan kolom kanan berakhir
  // di margin kanan (M + LEBAR). Nama dan NIP disejajarkan kanan di dalam
  // masing-masing kolom supaya rapi.
  const LEBAR_TTD = 70;
  const xKiri = M;
  // Blok tanda tangan tunggal (Kata Pengantar) ditaruh di tengah halaman,
  // digeser sedikit ke kanan supaya tidak terkesan menggantung di tengah.
  const xTunggal = 105 + 14 - LEBAR_TTD / 2;
  const xKanan = M + LEBAR - LEBAR_TTD;
  /** Titik tengah kolom tanda tangan; teks ditulis rata tengah di titik ini. */
  const tengahTtd = (x: number) => x + LEBAR_TTD / 2;
  doc.setFontSize(11);
  doc.text(`${kota}, ${hariIni}`, tengahTtd(xKanan), y, { align: 'center' });
  y += 3.6;

  const kolomTtd = [
    { x: xKiri, label: 'Mengesahkan,', jabatan: `Kepala Kantor Kemenag ${kota}`, nama: namaKantor, nip: nipKantor },
    { x: xKanan, label: 'Ketua Pokjawas Madrasah,', jabatan: '', nama: namaKetua, nip: nipKetua },
  ];
  // Blok tanda tangan disusun baris demi baris dengan nomor baris yang sama
  // untuk kedua kolom, supaya nama, NIP, dan baris jabatan benar-benar
  // sejajar mendatar antara kolom kiri dan kolom kanan.
  const barisTtd: Array<{ tinggi: number; cetak: (k: KolomTtd, yb: number) => void }> = [
    {
      tinggi: 5.8,
      cetak: (k, yb) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(k.label, tengahTtd(k.x), yb, { align: 'center' });
      },
    },
    {
      tinggi: 11.6,
      cetak: (k, yb) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        const jw = k.jabatan ? doc.splitTextToSize(k.jabatan, LEBAR_TTD) : [];
        if (jw.length) doc.text(jw, tengahTtd(k.x), yb, { align: 'center' });
      },
    },
    {
      // Jarak ke nama = 2 spasi (sesuai permintaan sebelumnya) + 16 mm ruang
      // tanda tangan + 3 spasi, dalam ukuran 1,5 spasi (5,8 mm).
      tinggi: 5.8 * 2 + 16 + 5.8 * 3 + 3.6,
      cetak: (k, yb) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(doc.splitTextToSize(k.nama, LEBAR_TTD), tengahTtd(k.x), yb, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`NIP. ${k.nip}`, tengahTtd(k.x), yb + 3.6, { align: 'center' });
      },
    },
  ];
  let yb = y;
  for (const baris of barisTtd) {
    for (const k of kolomTtd) baris.cetak(k, yb);
    yb += baris.tinggi;
  }

  // ===== 3. KATA PENGANTAR ==================================================
  doc.addPage();
  y = 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('KATA PENGANTAR', 105, y, { align: 'center' });
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  y = tulisParagraf(
    doc,
    'Puji syukur kami panjatkan kepada Tuhan Yang Maha Esa atas selesainya penyusunan Laporan Hasil Penilaian Kinerja Pengelolaan Kinerja Pengawas Madrasah (PKPM) ini. Penilaian kinerja pengawas madrasah merupakan bagian penting dari upaya menjaga dan meningkatkan mutu pengawasan pendidikan pada madrasah, sekaligus sarana memastikan bahwa pendampingan yang diberikan benar-benar menjawab kebutuhan madrasah binaan.',
    M, y, LEBAR,
  );
  y += 5;
  y = tulisParagraf(
    doc,
    'Penilaian dilaksanakan dengan menelaah bukti dokumen, melakukan klarifikasi, dan memeriksa konsistensi antara perencanaan, pelaksanaan, hasil, serta rencana tindak lanjut pada setiap pengawas madrasah. Hasil penilaian tidak semata-mata berfungsi sebagai angka, melainkan sebagai peta kebutuhan pembinaan agar setiap pengawas dapat berkembang sesuai jenjang jabatannya.',
    M, y, LEBAR,
  );
  y += 5;
  y = tulisParagraf(
    doc,
    `Pada kesempatan ini kami menyampaikan terima kasih kepada Kepala Kantor Kementerian Agama ${kabupaten}, tim penilai, seluruh pengawas madrasah, serta kepala madrasah dan pihak terkait yang telah membantu kelancaran penyusunan laporan ini. Kami menyadari laporan ini masih memiliki kekurangan, sehingga saran dan masukan yang membangun sangat kami harapkan demi penyempurnaan pada periode berikutnya.`,
    M, y, LEBAR,
  );
  y += 5;
  y = tulisParagraf(
    doc,
    `Semoga laporan ini memberikan manfaat bagi peningkatan mutu pengawasan madrasah dan pengembangan kompetensi pengawas madrasah di lingkungan Kantor Kementerian Agama ${kabupaten}.`,
    M, y, LEBAR,
  );
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${kota}, ${hariIni}`, tengahTtd(xTunggal), y, { align: 'center' });
  y += 5.8;
  doc.text('Ketua Pokjawas Madrasah,', tengahTtd(xTunggal), y, { align: 'center' });
  // Ruang tanda tangan dua spasi, lalu nama/NIP.
  y += 5.8 * 2 + 16;
  doc.setFont('helvetica', 'bold');
  doc.text(doc.splitTextToSize(namaKetua, LEBAR_TTD), tengahTtd(xTunggal), y, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`NIP. ${nipKetua}`, tengahTtd(xTunggal), y + 3.6, { align: 'center' });

  // ===== 4. DAFTAR ISI (halaman tersendiri, ditulis pada lintasan kedua) ===
  // Halaman ini WAJIB ditambahkan sekarang supaya Bab I tidak menimpa daftar
  // isi saat penulisan bab. Isinya diisi di akhir lewat doc.setPage().
  const halamanDaftarIsi = doc.getNumberOfPages() + 1;
  doc.addPage();

  // ===== 5-10. BAB I - VI ==================================================
  const tulisBab = (bab: Bab, lanjutDariPoin: (yy: number) => number): number => {
    doc.addPage();
    let yy = ATAS;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`BAB ${bab.no}`, 105, yy, { align: 'center' });
    yy += 6;
    doc.text(bab.judul, 105, yy, { align: 'center' });
    yy += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    for (const el of bab.isi) {
      if (el.jenis === 'sub') {
        yy = periksaRuang(yy, 18);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(bersih(el.teks), M, yy);
        doc.setFont('helvetica', 'normal');
        yy += 8.5;
        continue;
      }
      if (el.jenis === 'poin') {
        yy = periksaRuang(yy, 14);
        const lebarPoin = LEBAR - 5;
        const isiPoin = doc.splitTextToSize(bersih(el.teks), lebarPoin);
        const tinggiPoin = isiPoin.length * 5.8;
        if (yy + tinggiPoin > BAWAH && tinggiPoin <= BAWAH - ATAS) {
          yy = halamanBaru();
        }
        doc.setFontSize(11);
        doc.text('-', M, yy);
        doc.setLineHeightFactor(5.8 / (doc.getFontSize() * 0.3528));
        doc.text(bersih(el.teks), M + 5, yy, { align: 'justify', maxWidth: lebarPoin });
        doc.setLineHeightFactor(1.15);
        yy += tinggiPoin + 2.5;
        continue;
      }
      yy = tulisParagraf(doc, el.teks, M, yy, LEBAR);
      yy += 4.5;
    }
    return lanjutDariPoin(yy);
  };

  const babAwal: number[] = [];
  for (const bab of babData) {
    const akhirBab = tulisBab(bab, (yy) => yy);
    babAwal.push(doc.getNumberOfPages());
    if (bab.no === 'IV') {
      let yy = akhirBab + 4;
      yy = periksaRuang(yy, 45);
      tulisTabelPrioritas(doc, yy, prioritasLengkap, M, LEBAR);
    }
  }

  // ===== 11. LAMPIRAN: REKAP HASIL =========================================
  const halamanLampiran = doc.getNumberOfPages() + 1;
  doc.addPage();
  let yL = ATAS;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LAMPIRAN', 105, yL, { align: 'center' });
  yL += 6;
  doc.setFontSize(11);
  doc.text('REKAP HASIL PENILAIAN KINERJA PENGAWAS MADRASAH', 105, yL, { align: 'center' });
  yL += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Periode ${periode} · ${namaOrganisasi} · ${kabupaten}`, 105, yL, { align: 'center' });
  yL += 9;

  const wR = [10, 44, 34, 12, 12, 12, 12, 15, 21];
  const totalWR = wR.reduce((a, b) => a + b, 0);
  wR[1] += LEBAR_TABEL - totalWR;
  const colR = (i: number) => KIRI + wR.slice(0, i).reduce((a, b) => a + b, 0);
  const hdrR = ['No', 'Nama Pengawas', 'NIP', 'K1', 'K2', 'K3', 'K4', 'Akhir', 'Predikat'];

  const gambarKepalaRekap = () => {
    doc.setFillColor(23, 63, 112);
    doc.setTextColor(255, 255, 255);
    doc.rect(KIRI, yL, LEBAR_TABEL, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    for (const [i, h] of hdrR.entries()) {
      const tengah = i >= 3;
      doc.text(h, tengah ? colR(i) + wR[i] / 2 : colR(i) + 1.5, yL + 5.2, tengah ? { align: 'center' } : undefined);
    }
    yL += 8;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
  };
  gambarKepalaRekap();

  for (const r of rekap) {
    if (yL + 8 > 268) {
      doc.addPage();
      yL = ATAS;
      gambarKepalaRekap();
    }
    doc.setDrawColor(203, 213, 225);
    doc.rect(KIRI, yL, LEBAR_TABEL, 8);
    for (const cx of [colR(1), colR(2), colR(3), colR(4), colR(5), colR(6), colR(7), colR(8)]) {
      doc.line(cx, yL, cx, yL + 8);
    }
    doc.setFontSize(7.5);
    doc.text(String(r.no), colR(0) + 1.5, yL + 5.2);
    doc.text(bersih(r.nama), colR(1) + 1.5, yL + 5.2, { maxWidth: wR[1] - 3 });
    doc.text(bersih(r.nip), colR(2) + 1.5, yL + 5.2);
    doc.text(r.k1, colR(3) + wR[3] / 2, yL + 5.2, { align: 'center' });
    doc.text(r.k2, colR(4) + wR[4] / 2, yL + 5.2, { align: 'center' });
    doc.text(r.k3, colR(5) + wR[5] / 2, yL + 5.2, { align: 'center' });
    doc.text(r.k4, colR(6) + wR[6] / 2, yL + 5.2, { align: 'center' });
    doc.text(r.akhir, colR(7) + wR[7] / 2, yL + 5.2, { align: 'center' });
    doc.text(bersih(r.predikat), colR(8) + wR[8] / 2, yL + 5.2, { align: 'center' });
    yL += 8;
  }

  yL += 4;
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text(
    `Keterangan: K1 = ${NAMA_KOMPONEN.K1.judul} (${NAMA_KOMPONEN.K1.bobot}%), K2 = ${NAMA_KOMPONEN.K2.judul} (${NAMA_KOMPONEN.K2.bobot}%), K3 = ${NAMA_KOMPONEN.K3.judul} (${NAMA_KOMPONEN.K3.bobot}%), K4 = ${NAMA_KOMPONEN.K4.judul} (${NAMA_KOMPONEN.K4.bobot}%). Skor dalam skala 0-100.`,
    KIRI, yL, { maxWidth: LEBAR_TABEL },
  );
  yL += 16;
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(`Catatan: ${bersih(catatanSumber)}`, KIRI, yL, { maxWidth: LEBAR_TABEL - 45 });

  try {
    const qr = await QRCode.toDataURL(`e-PKPM|${bersih(org.id)}|${periode}|${total}|${angka(rataKabupaten)}`, { margin: 1 });
    const halamanTerakhir = doc.getNumberOfPages();
    doc.setPage(halamanTerakhir);
    const qy = Math.min(yL, 250);
    doc.addImage(qr, 'PNG', 160, qy, 32, 32);
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text('QR verifikasi ringkasan', 176, qy + 35, { align: 'center' });
  } catch {
    /* QR bersifat opsional */
  }

  // ===== 4. ISI DAFTAR ISI (lintasan kedua) ================================
  const halamanBabI = babAwal[0] ?? halamanLampiran;
  doc.setPage(halamanDaftarIsi);
  let yd = 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('DAFTAR ISI', 105, yd, { align: 'center' });
  yd += 16;

  const barisDaftar: Array<{ label: string; hal: number; tebal?: boolean }> = [
    { label: 'Halaman Judul (Cover)', hal: 1 },
    { label: 'Halaman Pengesahan', hal: 2 },
    { label: 'Kata Pengantar', hal: 3 },
    { label: 'Daftar Isi', hal: halamanDaftarIsi },
    ...babData.map((b, i) => ({ label: `BAB ${b.no}  ${b.namaDaftar.toUpperCase()}`, hal: babAwal[i], tebal: true })),
    { label: 'LAMPIRAN  REKAP HASIL PENILAIAN', hal: halamanLampiran, tebal: true },
  ];
  doc.setFontSize(11);
  for (const b of barisDaftar) {
    doc.setFont('helvetica', b.tebal ? 'bold' : 'normal');
    const teks = bersih(b.label);
    doc.text(teks, M, yd, { maxWidth: 120 });
    doc.text(String(b.hal), 210 - M, yd, { align: 'right' });
    // Titik-titik penuntun antar judul dan nomor halaman
    const lebarTeks = doc.getTextWidth(teks);
    const mulai = M + lebarTeks + 3;
    const akhir = 210 - M - 8;
    if (akhir > mulai) {
      const lebarTitik = doc.getTextWidth('.') || 1;
      let xTitik = mulai;
      doc.setTextColor(120, 120, 120);
      while (xTitik < akhir) {
        doc.text('.', xTitik, yd + 0.2);
        xTitik += lebarTitik + 0.5;
      }
      doc.setTextColor(0, 0, 0);
    }
    yd += 7;
  }

  // ===== FOOTER NOMOR HALAMAN (kecuali cover & pengesahan) =================
  const totalHalaman = doc.getNumberOfPages();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  for (let p = 3; p <= totalHalaman; p += 1) {
    doc.setPage(p);
    doc.text(String(p), 105, 288, { align: 'center' });
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(M, 285, 210 - M, 285);
  }

  return doc.output('blob');
}

/**
 * Gambar tabel prioritas PKB. Dipanggil dari dalam generateBukuLaporan, jadi
 * memakai dokumen yang sama. Mengembalikan posisi Y akhir tabel.
 */
function tulisTabelPrioritas(
  doc: jsPDF,
  y0: number,
  baris: BarisPrioritas[],
  x: number,
  lebar: number,
  tinggiHalaman = 272,
): number {
  const w = [10, 16, 62, 18, 22, 46];
  const totalW = w.reduce((a, b) => a + b, 0);
  w[2] += lebar - totalW;
  const col = (i: number) => x + w.slice(0, i).reduce((a, b) => a + b, 0);
  let y = y0;
  const kepala = () => {
    doc.setFillColor(23, 63, 112);
    doc.setTextColor(255, 255, 255);
    doc.rect(x, y, lebar, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const hdr = ['No', 'Kode', 'Indikator', 'Rata-rata', 'Skor Rendah', 'Rekomendasi PKB'];
    for (const [i, h] of hdr.entries()) {
      const tengah = i === 3 || i === 4;
      doc.text(h, tengah ? col(i) + w[i] / 2 : col(i) + 1.5, y + 4.6, tengah ? { align: 'center' } : undefined);
    }
    y += 7;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
  };
  kepala();
  if (!baris.length) {
    doc.setFontSize(8);
    doc.text('Belum ada butir prioritas yang dapat dihitung.', col(2) + 1.5, y + 4.5);
    return y + 9;
  }
  for (const [n, p] of baris.entries()) {
    const tJudul = doc.splitTextToSize(bersih(p.judul), w[2] - 3);
    const tPkb = doc.splitTextToSize(bersih(p.rekomendasi), w[5] - 3);
    const tinggi = Math.max(tJudul.length, tPkb.length, 1) * 4.2 + 3;
    if (y + tinggi > tinggiHalaman) {
      doc.addPage();
      y = 24;
      kepala();
    }
    doc.setDrawColor(203, 213, 225);
    doc.rect(x, y, lebar, tinggi);
    for (const cx of [col(1), col(2), col(3), col(4), col(5)]) doc.line(cx, y, cx, y + tinggi);
    doc.setFontSize(8);
    doc.text(String(n + 1), col(0) + 1.5, y + 4.5);
    doc.text(bersih(p.kode), col(1) + 1.5, y + 4.5);
    doc.text(tJudul, col(2) + 1.5, y + 4.5);
    doc.text(`${angka(p.rataRata)} / 2,00`, col(3) + w[3] / 2, y + 4.5, { align: 'center' });
    doc.text(String(p.jumlahLemah), col(4) + w[4] / 2, y + 4.5, { align: 'center' });
    doc.setFontSize(7);
    doc.text(tPkb, col(5) + 1.5, y + 4.5);
    y += tinggi;
  }
  return y + 2;
}

/**
 * Tulis paragraf rata kiri-kanan dengan pembungkusan otomatis dan tambah
 * halaman bila ruang habis.
 */
interface KolomTtd {
  x: number;
  label: string;
  jabatan: string;
  nama: string;
  nip: string;
}

function tulisParagraf(doc: jsPDF, teks: string, x: number, y0: number, lebar: number, tinggiBaris = 5.8): number {
  let y = y0;
  const kalimat = String(bersih(teks));
  const baris = doc.splitTextToSize(kalimat, lebar);
  const total = baris.length * tinggiBaris;

  // Kalau tidak cukup di sisa halaman, pindah halaman dulu (asal muat satu
  // halaman penuh). Paragraf yang lebih panjang dari satu halaman tetap
  // dicetak bertahap supaya tidak ada teks hilang.
  if (y + total > 272 && total <= 272 - 24) {
    doc.addPage();
    y = 24;
  }

  if (total <= 272 - 24 || y === 24) {
    // Satu blok sekaligus supaya jsPDF benar-benar merentangkan tiap baris
    // (rata kiri-kanan). Kalau baris dikirim satu per satu, semuanya dianggap
    // baris terakhir sehingga tidak pernah dijustify.
    doc.setLineHeightFactor(tinggiBaris / (doc.getFontSize() * 0.3528));
    doc.text(kalimat, x, y, { align: 'justify', maxWidth: lebar });
    doc.setLineHeightFactor(1.15);
    return y + total;
  }

  // Paragraf sangat panjang: cetak baris demi baris.
  for (let i = 0; i < baris.length; i += 1) {
    if (y > 272) {
      doc.addPage();
      y = 24;
    }
    const terakhir = i === baris.length - 1;
    doc.text(baris[i], x, y, terakhir ? undefined : { align: 'justify', maxWidth: lebar });
    y += tinggiBaris;
  }
  return y;
}
