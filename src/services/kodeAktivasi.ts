/**
 * Kode aktivasi & akun — sepenuhnya di Firebase (Firestore + Auth + Functions).
 *
 * Model:
 *   1 KODE = 1 AKUN. Kode membawa `orgId` (kabupaten) sehingga akun yang
 *   diaktivasi otomatis terikat ke wilayah pemilik kode.
 *
 * Admin TIDAK memakai kode aktivasi — admin masuk dengan username+password
 * dan tercatat di koleksi `admin/{uid}`.
 *
 * Semua operasi tulis yang bersifat otoritatif (klaim kode, buat kode,
 * nonaktifkan kode) dijalankan oleh Cloud Function `functions/src/index.ts`,
 * bukan oleh browser. Dengan begitu kode aktivasi tidak bisa dipalsukan
 * lewat DevTools.
 *
 * Bila Functions belum di-deploy, aplikasi tetap bisa dipakai dalam mode
 * "registri lokal" untuk uji coba — lihat `MODE_LOKAL`.
 */
import {
  getApps, getApp, initializeApp, type FirebaseApp,
} from 'firebase/app';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut as fbSignOut, onAuthStateChanged, type User as FbUser,
} from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs,
  query, where, serverTimestamp, type Firestore,
} from 'firebase/firestore';

import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { konfigAktif, type FirebaseConfig } from './firebaseCloud';

/* ------------------------------------------------------------------ */
/* Tipe                                                               */
/* ------------------------------------------------------------------ */

export type Peran = 'admin_kabupaten' | 'penilai' | 'pengawas';

export interface KodeAktivasi {
  code: string;
  orgId: string;
  peran: Peran;
  label?: string;
  aktif: boolean;
  dipakaiOleh?: string | null;
  dipakaiAt?: string | null;
  dibuatAt?: string;
  berlakuSampai?: string | null;
}

export interface ProfilAkun {
  uid: string;
  username: string;
  email: string;
  nama: string;
  peran: Peran;
  orgId: string;
  pengawasId?: string;
  aktif: boolean;
  kode?: string;
}

export interface AkunRingkas {
  uid: string;
  username: string;
  email?: string;
  nama: string;
  peran: Peran | string;
  orgId: string;
  pengawasId?: string;
  aktif: boolean;
  kode?: string | null;
  dibuatAt?: unknown;
  terakhirMasuk?: unknown;
}

export interface Org {
  id: string;
  nama: string;
  kabupaten: string;
  provinsi: string;
  ketua?: string;
  nip?: string;
  aktif: boolean;
}

export interface HasilAktivasi {
  sukses: boolean;
  alasan: string;
  profil?: ProfilAkun;
}

/* ------------------------------------------------------------------ */
/* Inisialisasi SDK (dipakai bersama dengan firebaseCloud)            */
/* ------------------------------------------------------------------ */

let appCache: FirebaseApp | null = null;
let authCache: any = null;
let fsCache: Firestore | null = null;
let fnCache: Functions | null = null;

function siapkan(cfg?: FirebaseConfig) {
  const konfig = cfg || konfigAktif();
  if (!konfig) throw new Error('Konfigurasi Firebase belum diisi.');
  if (!appCache) {
    appCache = getApps().length ? getApp() : initializeApp(konfig);
  }
  if (!authCache) authCache = getAuth(appCache);
  if (!fsCache) fsCache = getFirestore(appCache);
  if (!fnCache) {
    try { fnCache = getFunctions(appCache, 'asia-southeast2'); } catch { fnCache = null; }
  }
  return { app: appCache, auth: authCache, fs: fsCache!, fn: fnCache };
}

export function auth() { return siapkan().auth; }

/** Apakah konfigurasi Firebase sudah ada di perangkat ini. */
export function konfigAda(): boolean {
  try { return !!konfigAktif(); } catch { return false; }
}

/* ------------------------------------------------------------------ */
/* Generator & pemformat kode                                         */
/* ------------------------------------------------------------------ */

const HURUF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa I, O, 0, 1

/**
 * Format: EPKPM-{KODE ORG}-{PERAN}-{4 acak}.
 * Contoh: EPKPM-JBR-PNL-7QK4
 *
 * Fungsi ini hanya untuk pratinjau di UI. Kode resmi dibuat oleh Cloud
 * Function agar dijamin unik dan tidak bisa diakali dari klien.
 */
export function buatKode(orgId: string, peran: Peran): string {
  const kodeOrg = (orgId || 'ORG')
    .replace(/^POKJAWAS-/i, '')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 4)
    .toUpperCase() || 'ORG';
  const singkat = peran === 'penilai' ? 'PNL' : peran === 'pengawas' ? 'PGW' : 'ADM';
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  let acak = '';
  for (const b of buf) acak += HURUF[b % HURUF.length];
  return `EPKPM-${kodeOrg}-${singkat}-${acak}`;
}

/** Email internal Firebase Auth: username@e-pkpm.local (tidak dikirimi apa pun). */
export function emailDariUsername(username: string): string {
  const bersih = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return `${bersih}@e-pkpm.local`;
}

export function pesanAktivasi(alasan: string): string {
  const peta: Record<string, string> = {
    invalid_code: 'Kode aktivasi tidak dikenal atau sudah dinonaktifkan.',
    code_used: 'Kode ini sudah dipakai akun lain. Satu kode hanya untuk satu akun.',
    code_expired: 'Kode aktivasi sudah kedaluwarsa.',
    org_inactive: 'Organisasi pemilik kode sedang tidak aktif. Hubungi admin.',
    account_exists: 'Username sudah dipakai. Pilih username lain.',
    username_invalid: 'Username minimal 4 karakter, hanya huruf/angka/titik.',
    password_invalid: 'Password minimal 6 karakter.',
    no_config: 'Aplikasi belum tersambung ke Firebase. Buka menu Sinkron Cloud dan isi konfigurasi.',
    network_error: 'Tidak dapat menghubungi server. Sambungkan internet lalu coba lagi.',
    functions_unavailable: 'Layanan aktivasi belum di-deploy. Hubungi admin aplikasi.',
    user_not_found: 'Akun tidak ditemukan di server.',
    invalid_credentials: 'Username atau password salah.',
  };
  return peta[alasan] || `Aktivasi gagal (${alasan}).`;
}

/* ------------------------------------------------------------------ */
/* Aktivasi kode → akun                                               */
/* ------------------------------------------------------------------ */

/**
 * Klaim kode dan buat akun.
 * Alur: panggil Cloud Function `klaimKode` → buat akun Firebase Auth →
 * tulis profil ke `akun/{uid}`. Kode ditandai terpakai oleh Function.
 */
export async function aktivasiDenganKode(opts: {
  code: string;
  username: string;
  password: string;
  nama?: string;
}): Promise<HasilAktivasi> {
  const username = opts.username.trim();
  if (!/^[a-zA-Z0-9._-]{4,}$/.test(username))
    return { sukses: false, alasan: 'username_invalid' };
  if (opts.password.length < 6) return { sukses: false, alasan: 'password_invalid' };

  try {
    const { auth: fbAuth, fs, fn } = siapkan();
    if (!fn) return { sukses: false, alasan: 'functions_unavailable' };

    // 1. Validasi & kunci kode di server (atomik, tidak bisa dipalsukan).
    const klaim = httpsCallable(fn, 'klaimKode');
    const hasilKlaim = await klaim({
      code: opts.code.trim().toUpperCase(),
      username,
    }) as any;
    const data = hasilKlaim?.data as { sukses: boolean; alasan: string; orgId?: string; peran?: Peran } | undefined;
    if (!data?.sukses) {
      return { sukses: false, alasan: data?.alasan || 'invalid_code' };
    }

    // 2. Buat akun Firebase Auth.
    const kredensial = await createUserWithEmailAndPassword(
      fbAuth, emailDariUsername(username), opts.password,
    );
    const uid = kredensial.user.uid;

    // 3. Simpan profil ke akun/items/data/{uid}.
    //    Penulisan profil baru diizinkan aturan Firestore hanya untuk
    //    dokumen milik uid sendiri dan hanya saat dokumen belum ada;
    //    peran & orgId tetap divalidasi ulang oleh Function `tautkanAkun`.
    const profil: ProfilAkun = {
      uid,
      username,
      email: emailDariUsername(username),
      nama: opts.nama?.trim() || username,
      peran: data.peran || 'penilai',
      orgId: data.orgId || '',
      aktif: true,
      kode: opts.code.trim().toUpperCase(),
    };
    await setDoc(doc(fs, 'akun', 'items', 'data', uid), { ...profil, dibuatAt: serverTimestamp() });

    // 4. Beri tahu server agar akun dikaitkan ke kode.
    const tautkan = httpsCallable(fn, 'tautkanAkun');
    await tautkan({ uid, code: profil.kode }).catch(() => null);

    return { sukses: true, alasan: 'ok', profil };
  } catch (e: any) {
    const kode = e?.code || '';
    if (kode.includes('email-already-in-use')) return { sukses: false, alasan: 'account_exists' };
    if (kode.includes('network')) return { sukses: false, alasan: 'network_error' };
    return { sukses: false, alasan: 'network_error' };
  }
}

/* ------------------------------------------------------------------ */
/* Login                                                              */
/* ------------------------------------------------------------------ */

export async function loginAkun(opts: {
  username: string;
  password: string;
}): Promise<{ sukses: boolean; alasan: string; profil?: ProfilAkun }> {
  try {
    const { auth: fbAuth, fs } = siapkan();
    const kredensial = await signInWithEmailAndPassword(
      fbAuth, emailDariUsername(opts.username), opts.password,
    );
    const snap = await getDoc(doc(fs, 'akun', 'items', 'data', kredensial.user.uid));
    if (!snap.exists()) return { sukses: false, alasan: 'user_not_found' };
    const profil = snap.data() as ProfilAkun;
    if (!profil.aktif) return { sukses: false, alasan: 'user_not_found' };
    return { sukses: true, alasan: 'ok', profil };
  } catch (e: any) {
    const kode = e?.code || '';
    if (kode.includes('user-not-found') || kode.includes('wrong-password') || kode.includes('invalid-credential'))
      return { sukses: false, alasan: 'invalid_credentials' };
    if (kode.includes('network')) return { sukses: false, alasan: 'network_error' };
    return { sukses: false, alasan: 'invalid_credentials' };
  }
}

/**
 * Login admin — tanpa kode aktivasi.
 * Cek koleksi `admin` berdasarkan username; password diverifikasi oleh
 * Firebase Auth memakai email internal admin.
 */
export async function loginAdmin(opts: {
  username: string;
  password: string;
}): Promise<{ sukses: boolean; alasan: string; profil?: ProfilAkun }> {
  try {
    const { auth: fbAuth, fs } = siapkan();
    const kredensial = await signInWithEmailAndPassword(
      fbAuth, emailDariUsername(opts.username), opts.password,
    );
    const uid = kredensial.user.uid;
    const snapAdmin = await getDoc(doc(fs, 'admin', 'items', 'data', uid));
    if (!snapAdmin.exists()) {
      await fbSignOut(fbAuth);
      return { sukses: false, alasan: 'invalid_credentials' };
    }
    const snapAkun = await getDoc(doc(fs, 'akun', 'items', 'data', uid));
    const profil = snapAkun.exists()
      ? (snapAkun.data() as ProfilAkun)
      : ({ uid, username: opts.username, email: '', nama: opts.username, peran: 'admin_kabupaten', orgId: '', aktif: true } as ProfilAkun);
    return { sukses: true, alasan: 'ok', profil };
  } catch {
    return { sukses: false, alasan: 'invalid_credentials' };
  }
}

export async function keluar() {
  try { await fbSignOut(siapkan().auth); } catch { /* abaikan */ }
}

/** Pantau status login Firebase (untuk memulihkan sesi setelah refresh). */
export function pantauSesi(cb: (u: FbUser | null) => void) {
  try { return onAuthStateChanged(siapkan().auth, cb); } catch { return () => {}; }
}

/* ------------------------------------------------------------------ */
/* Admin: kelola kode                                                 */
/* ------------------------------------------------------------------ */

export async function terbitkanKode(opts: {
  orgId: string;
  peran: Peran;
  jumlah?: number;
  label?: string;
  berlakuSampai?: string | null;
}): Promise<{ sukses: boolean; kode: string[]; alasan: string }> {
  try {
    const { fn } = siapkan();
    if (!fn) return { sukses: false, kode: [], alasan: 'functions_unavailable' };
    const fnTerbit = httpsCallable(fn, 'terbitkanKode');
    const r = await fnTerbit({
      orgId: opts.orgId,
      peran: opts.peran,
      jumlah: Math.min(Math.max(opts.jumlah || 1, 1), 100),
      label: opts.label || '',
      berlakuSampai: opts.berlakuSampai || null,
    }) as any;
    const d = r?.data as { sukses: boolean; kode: string[]; alasan?: string };
    return { sukses: !!d?.sukses, kode: d?.kode || [], alasan: d?.alasan || 'ok' };
  } catch {
    return { sukses: false, kode: [], alasan: 'functions_unavailable' };
  }
}

export async function daftarKode(orgId: string): Promise<{ sukses: boolean; data: KodeAktivasi[]; alasan: string }> {
  try {
    const { fs } = siapkan();
    const kol = collection(fs, 'kodeAktivasi', 'items', 'data');
    // orgId kosong = admin belum menyebutkan organisasi. Jangan memfilter
    // dengan nilai kosong: kode terbitan selalu membawa orgId admin, jadi
    // query akan selalu nol. Security Rules sudah membatasi list ke admin.
    const q = orgId ? query(kol, where('orgId', '==', orgId)) : query(kol);
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ ...(d.data() as KodeAktivasi), code: d.id }));
    return { sukses: true, data, alasan: 'ok' };
  } catch {
    return { sukses: false, data: [], alasan: 'network_error' };
  }
}

/**
 * Aktifkan / nonaktifkan kode. Dijalankan lewat Cloud Function `ubahStatusKode`
 * supaya hanya admin yang bisa mengubah (bukan sekadar tulis dari browser).
 */
export async function ubahStatusKode(opts: {
  code: string;
  aktif: boolean;
}): Promise<{ sukses: boolean; alasan: string }> {
  try {
    const { fn } = siapkan();
    if (fn) {
      const ubah = httpsCallable(fn, 'ubahStatusKode');
      const r = await ubah({ code: opts.code, aktif: opts.aktif }) as any;
      const d = r?.data as { sukses: boolean; alasan: string } | undefined;
      if (d) return { sukses: !!d.sukses, alasan: d.alasan || 'ok' };
    }
    // Cadangan bila Functions belum di-deploy: tulis langsung (butuh admin).
    const { fs } = siapkan();
    await updateDoc(doc(fs, 'kodeAktivasi', 'items', 'data', opts.code), { aktif: opts.aktif });
    return { sukses: true, alasan: 'ok' };
  } catch {
    return { sukses: false, alasan: 'network_error' };
  }
}

/**
 * Daftar seluruh akun terdaftar (koleksi `akun`). Dipakai panel admin untuk
 * memantau siapa yang sudah aktivasi dan siapa yang belum.
 * Security Rules membatasi list ke admin kabupaten (`adminKab()`).
 */
export async function daftarAkun(): Promise<{ sukses: boolean; data: AkunRingkas[]; alasan: string }> {
  try {
    const { fs } = siapkan();
    const snap = await getDocs(collection(fs, 'akun', 'items', 'data'));
    const data: AkunRingkas[] = snap.docs.map(d => {
      const v = d.data() as any;
      return {
        uid: d.id,
        username: String(v.username || ''),
        email: String(v.email || ''),
        nama: String(v.nama || v.username || ''),
        peran: (v.peran as Peran) || 'penilai',
        orgId: String(v.orgId || ''),
        pengawasId: v.pengawasId ? String(v.pengawasId) : undefined,
        aktif: v.aktif !== false,
        kode: v.kode ? String(v.kode) : null,
        dibuatAt: v.dibuatAt ?? null,
        terakhirMasuk: v.terakhirMasuk ?? null,
      };
    });
    return { sukses: true, data, alasan: 'ok' };
  } catch {
    return { sukses: false, data: [], alasan: 'network_error' };
  }
}

export async function daftarOrg(): Promise<Org[]> {
  try {
    const { fs } = siapkan();
    const snap = await getDocs(collection(fs, 'org', 'items', 'data'));
    return snap.docs.map(d => ({ ...(d.data() as Org), id: d.id }));
  } catch {
    return [];
  }
}
