/**
 * Klien Pusat Lisensi Aplikasi (Supabase RPC).
 *
 * Project: pusat-lisensi-aplikasi — llaukzsztguwrtwdubpm.supabase.co
 *
 * Model lisensi: 1 KODE AKTIVASI = 1 AKUN (bukan 1 perangkat).
 * Semua operasi lewat RPC SECURITY DEFINER — kode aplikasi tidak pernah
 * menyentuh tabel langsung (RLS memblokir akses anon).
 *
 * Dipakai untuk:
 *   - registrasi akun (kode + username + password)
 *   - login lintas perangkat
 *   - panel admin: terbitkan & kelola kode
 *
 * Bila jaringan tidak tersedia, fungsi mengembalikan `network_error` —
 * pemanggil yang memutuskan apakah boleh jatuh ke mode lokal.
 */

export const PUSAT_URL = 'https://llaukzsztguwrtwdubpm.supabase.co';
export const PUSAT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsYXVrenN6dGd1d3J0d2R1YnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxOTI1NDgsImV4cCI6MjEwMjc2ODU0OH0.DqKtA0aus9nOLViMEWjAPvYIAdLS_EKU3H8dYKe_Zhk';

/** Slug aplikasi e-PKPM di Pusat Lisensi. */
export const APP_SLUG = 'e-pkpm';

const TIMEOUT_MS = 12000;

async function timeoutFetch(url: string, opts: RequestInit, ms: number) {
  return Promise.race([
    fetch(url, opts),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout ' + ms + 'ms')), ms),
    ),
  ]);
}

/** Panggil RPC Pusat Lisensi. Melempar Error bila jaringan/HTTP bermasalah. */
export async function callRpc<T = any>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await timeoutFetch(
    `${PUSAT_URL}/rest/v1/rpc/${fn}`,
    {
      method: 'POST',
      headers: {
        apikey: PUSAT_ANON_KEY,
        Authorization: `Bearer ${PUSAT_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    },
    TIMEOUT_MS,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`RPC ${fn} gagal: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * SHA-256 hex. Password TIDAK pernah dikirim sebagai teks biasa.
 * Catatan keamanan: hash dilakukan di klien, jadi server menerima hash.
 * Ini mengikuti pola aplikasi lain di Pusat Lisensi.
 */
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Ubah pesan alasan server jadi kalimat yang bisa dibaca pengguna. */
export function pesanAlasan(reason: string): string {
  const map: Record<string, string> = {
    claimed: 'Akun berhasil dibuat.',
    ok: 'Login berhasil.',
    invalid_code: 'Kode aktivasi tidak dikenal atau tidak aktif.',
    code_used: 'Kode ini sudah dipakai akun lain. Satu kode hanya untuk satu akun.',
    account_exists: 'Username sudah dipakai. Pilih username lain.',
    username_invalid: 'Username minimal 4 karakter.',
    password_invalid: 'Password tidak boleh kosong.',
    invalid_credentials: 'Username atau password salah.',
    revoked: 'Akun ini sudah dinonaktifkan. Hubungi admin.',
    inactive: 'Lisensi tidak aktif. Hubungi admin.',
    invalid_admin_key: 'Admin Key salah.',
    network_error: 'Tidak dapat menghubungi Pusat Lisensi. Periksa koneksi internet.',
  };
  return map[reason] || `Gagal: ${reason}`;
}

// ============================================================
// API PENGGUNA
// ============================================================

export interface HasilRegistrasi {
  success: boolean;
  reason: string;
  username?: string;
}

/** Klaim 1 kode aktivasi menjadi 1 akun. Kode terkunci ke akun ini. */
export async function registerAccount(opts: {
  code: string;
  username: string;
  password: string;
  fullname?: string;
  madrasah?: string;
  deviceInfo?: string;
}): Promise<HasilRegistrasi> {
  try {
    const password_hash = await sha256(opts.password);
    const r = await callRpc<HasilRegistrasi>('register_account', {
      p_code: opts.code.trim().toUpperCase(),
      p_app_slug: APP_SLUG,
      p_username: opts.username,
      p_password_hash: password_hash,
      p_fullname: opts.fullname || '',
      p_madrasah: opts.madrasah || '',
      p_device_info: opts.deviceInfo || navigator.userAgent,
    });
    return r;
  } catch {
    return { success: false, reason: 'network_error' };
  }
}

export interface HasilLogin {
  valid: boolean;
  reason: string;
  username?: string;
  fullname?: string;
  madrasah?: string;
  role?: string;
  license_code?: string;
  tier?: string;
}

/**
 * Login akun. Bisa dipanggil dari perangkat mana pun.
 * `touch=false` dipakai untuk verifikasi berkala tanpa mengubah last_login.
 */
export async function loginAccount(opts: {
  username: string;
  password: string;
  touch?: boolean;
}): Promise<HasilLogin> {
  try {
    const password_hash = await sha256(opts.password);
    return await callRpc<HasilLogin>('login_account', {
      p_app_slug: APP_SLUG,
      p_username: opts.username,
      p_password_hash: password_hash,
      p_device_info: navigator.userAgent,
      p_touch: opts.touch !== false,
    });
  } catch {
    return { valid: false, reason: 'network_error' };
  }
}

/** Cek apakah server Pusat Lisensi bisa dihubungi. */
export async function pusatOnline(): Promise<boolean> {
  try {
    await callRpc('verify_admin_key', { p_admin_key: '__ping__' });
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// API ADMIN (butuh Admin Key Pusat Lisensi)
// ============================================================

export interface KodeLisensi {
  id?: string;
  code: string;
  app_slug?: string;
  tier?: string;
  is_active?: boolean;
  used_by?: string | null;
  recipient?: string;
  created_at?: string;
  activated_at?: string | null;
  max_devices?: number;
  device_count?: number;
}

export async function adminGenerateCode(adminKey: string, recipient = ''): Promise<any> {
  try {
    return await callRpc('admin_generate_code', {
      p_admin_key: adminKey,
      p_app_slug: APP_SLUG,
      p_recipient: recipient,
    });
  } catch {
    return { success: false, reason: 'network_error' };
  }
}

export async function adminBatchCreateCodes(
  adminKey: string,
  count: number,
  recipient = '',
): Promise<any> {
  try {
    return await callRpc('admin_batch_create_codes', {
      p_admin_key: adminKey,
      p_count: count,
      p_app_slug: APP_SLUG,
      p_recipient: recipient,
    });
  } catch {
    return { success: false, reason: 'network_error', codes: [] };
  }
}

/** Daftarkan kode eksplisit (format bebas) ke server. */
export async function adminRegisterCode(
  adminKey: string,
  code: string,
  tier = 'pro',
  recipient = '',
): Promise<any> {
  try {
    return await callRpc('admin_register_code', {
      p_admin_key: adminKey,
      p_code: code,
      p_app_slug: APP_SLUG,
      p_tier: tier,
      p_recipient: recipient,
      p_app_name: 'e-PKPM Pengawas',
      p_max_devices: 1,
    });
  } catch {
    return { success: false, reason: 'network_error' };
  }
}

export async function adminListCodes(adminKey: string): Promise<KodeLisensi[]> {
  try {
    const r = await callRpc<any>('admin_list_codes', {
      p_admin_key: adminKey,
      p_app_slug: APP_SLUG,
    });
    return r && r.success ? r.codes || [] : [];
  } catch {
    return [];
  }
}

export async function adminListAccounts(adminKey: string): Promise<any[]> {
  try {
    const r = await callRpc<any>('admin_list_accounts', {
      p_admin_key: adminKey,
      p_app_slug: APP_SLUG,
    });
    return r && r.success ? r.accounts || [] : [];
  } catch {
    return [];
  }
}

export async function adminGetStats(adminKey: string): Promise<any> {
  try {
    return await callRpc('admin_get_stats', { p_admin_key: adminKey, p_app_slug: APP_SLUG });
  } catch {
    return { success: false, reason: 'network_error' };
  }
}

export async function adminRevokeCode(adminKey: string, code: string): Promise<any> {
  try {
    return await callRpc('admin_revoke_code', {
      p_admin_key: adminKey,
      p_code: code.toUpperCase(),
    });
  } catch {
    return { success: false, reason: 'network_error' };
  }
}

export async function adminReactivateCode(adminKey: string, code: string): Promise<any> {
  try {
    return await callRpc('admin_reactivate_code', {
      p_admin_key: adminKey,
      p_code: code.toUpperCase(),
    });
  } catch {
    return { success: false, reason: 'network_error' };
  }
}

export async function adminDeleteCode(adminKey: string, code: string): Promise<any> {
  try {
    return await callRpc('admin_delete_code', {
      p_admin_key: adminKey,
      p_code: code.toUpperCase(),
    });
  } catch {
    return { success: false, reason: 'network_error' };
  }
}

/** Uji Admin Key tanpa efek samping. */
export async function verifyAdminKey(adminKey: string): Promise<boolean> {
  try {
    const r = await callRpc<any>('verify_admin_key', { p_admin_key: adminKey });
    return !!(r && (r.valid === true || r.success === true));
  } catch {
    return false;
  }
}
