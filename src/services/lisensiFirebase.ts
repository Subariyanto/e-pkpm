/**
 * Lapisan kompatibilitas akun — jembatan dari Pusat Lisensi (Supabase RPC)
 * ke Firebase (Firestore + Auth + Cloud Functions).
 *
 * Semua fungsi di sini memakai bentuk kembalian yang SAMA dengan
 * `pusatLisensi.ts`, sehingga layar login, aktivasi, dan panel kode tidak
 * perlu diubah lagi. Kalau suatu saat perlu kembali ke Pusat Lisensi,
 * cukup ganti impor di pemanggil.
 *
 * Perbedaan penting dibanding Pusat Lisensi:
 *   - Password TIDAK lagi di-hash di klien. Firebase Auth menanganinya
 *     sendiri (SCRAM) dan tidak pernah mengirim teks asli ke Firestore.
 *   - Kode aktivasi diklaim atomik oleh Cloud Function `klaimKode`, jadi
 *     tidak bisa dipalsukan lewat DevTools.
 */
import {
  aktivasiDenganKode, loginAkun, loginAdmin as loginAdminFirebase,
  terbitkanKode, daftarKode, daftarAkun, ubahStatusKode, daftarOrg,
  pesanAktivasi, auth, konfigAda,
  type ProfilAkun, type Org, type AkunRingkas,
} from './kodeAktivasi';

/* ------------------------------------------------------------------ */
/* Bentuk hasil — sama dengan pusatLisensi                             */
/* ------------------------------------------------------------------ */

export interface HasilRegistrasi {
  success: boolean;
  reason: string;
  username?: string;
}

export interface HasilLogin {
  valid: boolean;
  reason: string;
  username?: string;
  fullname?: string;
  role?: string;
  license_code?: string;
  tier?: string;
}

export interface KodeLisensi {
  id?: string;
  code: string;
  recipient?: string | null;
  is_active: boolean;
  used_by?: string | null;
  used_at?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
}

export interface AkunTerdaftar {
  uid: string;
  username: string;
  nama: string;
  email: string;
  peran: string;
  orgId: string;
  aktif: boolean;
  kode: string | null;
  dibuat_at: string | null;
}

/** Petakan alasan dari lapisan Firebase ke kalimat siap tampil. */
export function pesanAlasan(reason: string): string {
  const map: Record<string, string> = {
    ok: 'Login berhasil.',
    invalid_code: 'Kode aktivasi tidak dikenal atau tidak aktif.',
    code_used: 'Kode ini sudah dipakai akun lain. Satu kode hanya untuk satu akun.',
    code_expired: 'Kode aktivasi sudah kedaluwarsa.',
    org_inactive: 'Kabupaten pemilik kode sedang tidak aktif. Hubungi admin.',
    account_exists: 'Username sudah dipakai. Pilih username lain.',
    username_invalid: 'Username minimal 4 karakter, hanya huruf/angka/titik.',
    password_invalid: 'Password minimal 6 karakter.',
    invalid_credentials: 'Username atau password salah.',
    revoked: 'Akun ini sudah dinonaktifkan. Hubungi admin.',
    inactive: 'Akun tidak aktif. Hubungi admin.',
    unauthorized: 'Anda tidak berwenang melakukan tindakan ini.',
    no_config: 'Aplikasi belum tersambung ke Firebase. Buka menu Sinkron Cloud dan isi konfigurasi.',
    no_firebase: 'Aplikasi belum tersambung ke Firebase. Buka menu Sinkron Cloud dan isi konfigurasi.',
    network_error: 'Tidak dapat menghubungi server. Periksa koneksi internet lalu coba lagi.',
    functions_unavailable: 'Layanan aktivasi belum di-deploy. Hubungi admin aplikasi.',
    user_not_found: 'Akun tidak ditemukan di server.',
    auth_error: 'Gagal membuat akun. Coba lagi.',
    generate_failed: 'Gagal membuat kode baru. Coba lagi.',
    invalid_peran: 'Peran tidak dikenal.',
    invalid_org: 'Kabupaten belum ditentukan.',
  };
  return map[reason] || pesanAktivasi(reason);
}

/* ------------------------------------------------------------------ */
/* Pengguna                                                           */
/* ------------------------------------------------------------------ */

/** Klaim 1 kode aktivasi menjadi 1 akun Firebase Auth + profil Firestore. */
export async function registerAccount(opts: {
  code: string;
  username: string;
  password: string;
  fullname?: string;
  madrasah?: string;
  deviceInfo?: string;
}): Promise<HasilRegistrasi> {
  if (!konfigAda()) return { success: false, reason: 'no_firebase' };
  const r = await aktivasiDenganKode({
    code: opts.code,
    username: opts.username,
    password: opts.password,
    nama: opts.fullname,
  });
  return {
    success: r.sukses,
    reason: r.sukses ? 'claimed' : r.alasan,
    username: r.profil?.username || opts.username.trim().toLowerCase(),
  };
}

/** Login akun dari perangkat mana pun. */
export async function loginAccount(opts: {
  username: string;
  password: string;
  touch?: boolean;
}): Promise<HasilLogin> {
  if (!konfigAda()) return { valid: false, reason: 'no_firebase' };
  const r = await loginAkun({ username: opts.username, password: opts.password });
  if (!r.sukses) return { valid: false, reason: r.alasan };
  return {
    valid: true,
    reason: 'ok',
    username: r.profil?.username,
    fullname: r.profil?.nama,
    role: r.profil?.peran,
    license_code: r.profil?.kode,
  };
}

/**
 * Login admin. Sama seperti alur Pusat Lisensi: cek dulu apakah akun ini
 * admin, dan kembalikan penanda `admin_key` yang dipakai panel kode.
 * Di Firebase tidak ada Admin Key terpisah — `admin_key` di sini adalah
 * uid admin, dan kewenangan sebenarnya tetap diverifikasi server.
 */
export async function adminLogin(
  username: string,
  password: string,
): Promise<{ success: boolean; reason: string; admin_key?: string; username?: string; fullname?: string }> {
  if (!konfigAda()) return { success: false, reason: 'no_firebase' };
  const r = await loginAdminFirebase({ username, password });
  if (!r.sukses || !r.profil) {
    // Bukan admin: keluar dari sesi admin supaya login pengguna bisa jalan.
    return { success: false, reason: r.alasan };
  }
  return {
    success: true,
    reason: 'ok',
    admin_key: r.profil.uid,
    username: r.profil.username,
    fullname: r.profil.nama,
  };
}

/** Apakah lapisan Firebase siap dipakai (konfigurasi ada). */
export async function pusatOnline(): Promise<boolean> {
  return konfigAda();
}

/* ------------------------------------------------------------------ */
/* Admin: kelola kode                                                 */
/* ------------------------------------------------------------------ */

function keKodeLisensi(k: {
  code: string; peran?: string; label?: string; aktif: boolean;
  dipakaiOleh?: string | null; dipakaiAt?: string | null;
  dibuatAt?: string | null; berlakuSampai?: string | null;
}): KodeLisensi {
  return {
    id: k.code,
    code: k.code,
    recipient: k.label || null,
    is_active: k.aktif !== false,
    used_by: k.dipakaiOleh || null,
    used_at: k.dipakaiAt || null,
    created_at: k.dibuatAt || null,
    expires_at: k.berlakuSampai || null,
  };
}

/** Terbitkan kode baru (otomatis). `orgId` diambil dari profil admin oleh server. */
export async function adminGenerateCode(
  _adminKey: string,
  recipient?: string,
  orgId = '',
): Promise<{ success: boolean; reason: string; code?: string }> {
  const r = await terbitkanKode({ orgId, peran: 'penilai', jumlah: 1, label: recipient });
  return r.sukses
    ? { success: true, reason: 'ok', code: r.kode[0] }
    : { success: false, reason: r.alasan };
}

/** Terbitkan beberapa kode sekaligus. */
export async function adminBatchCreateCodes(
  _adminKey: string,
  jumlah: number,
  recipient?: string,
  orgId = '',
): Promise<{ success: boolean; reason: string; codes?: string[] }> {
  const r = await terbitkanKode({ orgId, peran: 'penilai', jumlah, label: recipient });
  return r.sukses
    ? { success: true, reason: 'ok', codes: r.kode }
    : { success: false, reason: r.alasan };
}

/**
 * Kode manual ("kode sendiri") tidak lagi didukung: kode harus dibuat
 * server agar dijamin unik dan tidak bisa ditabrak kode lain.
 */
export async function adminRegisterCode(
  _adminKey: string,
  _kode: string,
  _tier?: string,
  _recipient?: string,
): Promise<{ success: boolean; reason: string }> {
  return { success: false, reason: 'generate_failed' };
}

/** Daftar kode milik kabupaten admin yang sedang login. */
export async function adminListCodes(_adminKey: string, orgId = ''): Promise<KodeLisensi[]> {
  const r = await daftarKode(orgId);
  return r.sukses ? r.data.map(keKodeLisensi) : [];
}

export async function adminGetStats(_adminKey: string, orgId = '') {
  const r = await daftarKode(orgId);
  const kode = r.sukses ? r.data : [];
  return {
    total: kode.length,
    aktif: kode.filter(k => k.aktif !== false).length,
    terpakai: kode.filter(k => !!k.dipakaiOleh).length,
  };
}

/**
 * Daftar akun terdaftar (untuk pemantauan aktivasi di panel admin).
 * Mengembalikan alasan kegagalan supaya UI bisa membedakan "belum ada akun"
 * dengan "tidak berwenang membaca koleksi akun".
 */
export async function adminListAccounts(
  _adminKey: string,
): Promise<{ success: boolean; reason: string; data: AkunTerdaftar[] }> {
  const r = await daftarAkun();
  if (!r.sukses) return { success: false, reason: r.alasan, data: [] };
  const data = r.data.map((a: AkunRingkas) => ({
    uid: a.uid,
    username: a.username,
    nama: a.nama,
    email: a.email || '',
    peran: a.peran || 'penilai',
    orgId: a.orgId || '',
    aktif: a.aktif !== false,
    kode: a.kode || null,
    dibuat_at: (a.dibuatAt as any)?.toDate?.()?.toISOString?.()
      || (typeof a.dibuatAt === 'string' ? a.dibuatAt : null),
  }));
  return { success: true, reason: 'ok', data };
}

/** Verifikasi kunci admin — di Firebase cukup memastikan sesi login valid. */
export async function verifyAdminKey(_adminKey: string): Promise<boolean> {
  try {
    return !!auth().currentUser;
  } catch {
    return false;
  }
}

export async function adminRevokeCode(_adminKey: string, code: string) {
  const r = await ubahStatusKode({ code, aktif: false });
  return { success: r.sukses, reason: r.alasan };
}

export async function adminReactivateCode(_adminKey: string, code: string) {
  const r = await ubahStatusKode({ code, aktif: true });
  return { success: r.sukses, reason: r.alasan };
}

/**
 * Hapus kode permanen. Di Firebase, kode yang sudah terpakai sebaiknya
 * dinonaktifkan saja karena akunnya sudah ada; penghapusan dokumen kode
 * dilakukan dari Console. Fungsi ini menonaktifkan plus mengosongkan label.
 */
export async function adminDeleteCode(_adminKey: string, code: string) {
  const r = await ubahStatusKode({ code, aktif: false });
  return { success: r.sukses, reason: r.alasan };
}

/** Daftar organisasi/kabupaten. */
export async function daftarOrganisasi(): Promise<Org[]> {
  return daftarOrg();
}

export type { ProfilAkun, Org, AkunRingkas };
