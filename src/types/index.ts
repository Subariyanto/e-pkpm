export type Role='admin'|'assessor'; export type Status='draft'|'process'|'final';
export type ComponentKey='K1'|'K2'|'K3'|'K4';
export type InstrumentVersion='legacy-1-4'|'pkpm-0-2-v2';
export type Level='Muda'|'Madya'|'Utama';
export type RtlStatus='belum'|'proses'|'selesai';
export type Jenjang=Level;
export interface Org {id:string;name:string;district:string;province:string;chairman:string;headOffice:string;address:string;phone:string;email:string;period:string}
export interface User {id:string;name:string;username:string;pinHash:string;roles:Role[];nip:string;active:boolean;failed:number;lockedUntil?:number;
 /** Kode aktivasi yang mengikat akun ini (Opsi A: 1 kode = 1 akun, data lokal). */
 activationCode?:string;
 /** Nama perangkat tempat akun pertama kali diaktivasi. */
 deviceName?:string;
 /** Waktu aktivasi terakhir. */
 activatedAt?:string;
}
/** Kode aktivasi yang dikenal perangkat ini (validasi lokal, tanpa server). */
export interface ActivationCode {id:string;code:string;label:string;orgId:string;maxAccounts:number;active:boolean;createdAt:string;}
export interface Supervisor {id:string;name:string;nip:string;rank:string;position:string;level:string;workUnit:string;region:string;schools:number;principals:number;teachers:number;phone:string;email:string;assessorId?:string;active:boolean;skNumber?:string;skDate?:string}
/** Aspek penilaian pada indikator (checklist keterpenuhan). */
export interface Aspect {id:string;label:string}
/** Dokumen yang harus ditelaah pada indikator (tanpa unggah eviden). */
export interface DocSpec {id:string;name:string}
export interface Indicator {
 id:string;component:ComponentKey;subcomponent:string;code:string;description:string;
 /** Judul singkat indikator (v2). */
 title?:string;
 /** Uraian lengkap indikator (v2). */
 uraian?:string;
 documents:string[];
 weight:number;maxScore:number;required:boolean;pkb:string;active:boolean;order:number;
 descriptors:Record<number,string>;
 /* ===== Field versi pkpm-0-2-v2 ===== */
 version?:InstrumentVersion;
 /** Jenjang jabatan yang berlaku: Muda/Madya/Utama. */
 levels?:Level[];
 aspects?:Aspect[];
 /** Kriteria/rubrik skor 0,1,2 (v2). */
 criteria?:Record<0|1|2,string>;
 /** Contoh kondisi yang sesuai tiap skor. */
 examples?:Record<0|1|2,string>;
 /** Dokumen terstruktur (v2). */
 docSpecs?:DocSpec[];
 /** Metode verifikasi/penggalian data. */
 verification?:string[];
 /** Bentuk kegiatan PKB yang direkomendasikan. */
 pkbActivity?:string;
 /** RTL default (masalah/tindakan/produk). */
 defaultRtl?:Partial<Rtl>;
 /** Periode mulai berlaku. */
 validFrom?:string;
 /** Versi instrumen (alias lama `versiInstrumen`). */
 versiInstrumen?:InstrumentVersion;
 /** Jenjang jabatan yang berlaku (alias lama `jenjangBerlaku`). */
 jenjangBerlaku?:Level[];
 /** Daftar aspek sebagai label teks (alias lama `aspek`). */
 aspek:string[];
 /** Rubrik kriteria per skor (alias lama `kriteriaSkor`). */
 kriteriaSkor:Record<number,string>;
 /** Contoh kondisi per skor (alias lama `contohKondisi`). */
 contohKondisi?:Record<number,string>;
 /** Bentuk kegiatan PKB yang direkomendasikan (alias lama). */
 rekomendasiPKB?:string;
 /** Alias lama: metode verifikasi. */
 metodeVerifikasi?:string[];
 /** Alias lama: RTL default. */
 rtlDefault?:Partial<Rtl>|'';
 /** Alias lama: periode mulai berlaku. */
 periodeMulai?:string;
}
/** Rencana Tindak Lanjut per indikator. */
export interface Rtl {problem:string;rootCause:string;action:string;product:string;pkbForm:string;targetDate:string;pic:string;evidence:string;status:RtlStatus}
/** Dokumen yang ditelaah penilai (ditemukan/tidak). */
export interface DocReview {docId:string;name:string;found:boolean;number:string;date:string;note:string}
export interface Assessment {
 id:string;supervisorId:string;assessorId:string;periodId:string;indicatorId:string;
 documentName:string;documentNumber:string;documentDate:string;documentStatus:string;review:string;
 score?:number;notes:string;finding:string;recommendation:string;updatedAt:string;
 /* ===== Field versi pkpm-0-2-v2 ===== */
 version?:InstrumentVersion;
 /** Tidak berlaku (N/A): tidak dihitung, baris abu-abu. */
 na?:boolean;naReason?:string;
 /** Checklist aspek: aspectId -> terpenuhi. */
 aspectsMet?:Record<string,boolean>;
 /** Alasan penilai bila skor berbeda dari rekomendasi aspek. */
 scoreOverrideReason?:string;
 /** Telaah dokumen per docSpec. */
 docs?:DocReview[];
 /** Kekuatan/kekurangan/ketidaksesuaian/klarifikasi. */
 strengths?:string;weaknesses?:string;mismatches?:string;clarification?:string;
 rtl?:Rtl;
 /** Catatan otomatis sudah diedit manual? */
 notesEdited?:boolean;
 /* ===== Alias field UI (dipakai halaman penilaian v2) ===== */
 documentFound:boolean;
 aspekChecklist:boolean[];
 aspekPercent:number;
 recommendedScore:number;
 telaahDokumen:string;
 wawancara:string;
 konfirmasi:string;
 konsistensi:string;
 rtlMasalah:string;
 rtlAkarMasalah:string;
 rtlTindakan:string;
 rtlProduk:string;
 rtlBentukPKB:string;
 rtlTarget:string;
 rtlPIC:string;
 rtlBukti:string;
 rtlStatus:RtlStatus|'';
}
export interface Result {
 id:string;supervisorId:string;assessorId:string;periodId:string;
 scores:Record<string,number>;componentScores:Record<string,number>;
 finalScore:number;predicate:string;priorities:string[];status:Status;finalizedAt?:string;
 /* ===== Field versi pkpm-0-2-v2 ===== */
 instrumentVersion?:InstrumentVersion;
 /** Konversi komponen ke skala 0–4 untuk kompatibilitas laporan lama. */
 componentScores4?:Record<string,number>;
 /** Bobot komponen yang dipakai saat perhitungan. */
 weights?:Record<string,number>;
 mechanism?:'individual'|'panel';
 skNumber?:string;skDate?:string;
 /* ===== Alias field UI/laporan ===== */
 skPenugasan?:string;
 tanggalSk?:string;
 mekanismePenilaian?:'individual'|'panel';
 componentScoresConverted?:Record<string,number>;
}
export interface Period {id:string;year:number;schoolYear:string;start:string;end:string;status:'draft'|'active'|'closed'|'locked';instrumentVersion?:InstrumentVersion;instrumenVersi?:InstrumentVersion}
export interface Audit {id?:number;user:string;at:string;action:string;object:string;oldValue?:string;newValue?:string;reason?:string;device:string}
export interface PredikatRow {id?:string;min:number;max?:number;label:string;order?:number}
export interface BobotKomponen {component?:ComponentKey;weight?:number;order?:number;K1?:number;K2?:number;K3?:number;K4?:number}
export interface Snapshot {id:string;at:string;user:string;kind:string;supervisorId?:string;periodId?:string;data:string}
export interface Regulation {id:string;number?:string;title?:string;year?:number;status?:'berlaku'|'diubah'|'dicabut'|'pedoman'|'referensi'|'pedoman_teknis'|string;note?:string;order?:number;nomor?:string;tentang?:string;jenis?:string;tahun?:number;link?:string;catatan?:string;judul?:string;kategori?:string;urutan?:number}
export type Regulasi=Regulation;
