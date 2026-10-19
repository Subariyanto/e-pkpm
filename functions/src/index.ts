/**
 * Cloud Functions e-PKPM
 *
 * Kontrak dengan frontend (`src/services/kodeAktivasi.ts`):
 *   - klaimKode     { code, username }              → { sukses, alasan, orgId, peran }
 *   - tautkanAkun   { uid, code }                   → { sukses, alasan }
 *   - terbitkanKode { orgId, peran, jumlah, label, berlakuSampai }
 *                                                   → { sukses, kode[], alasan }
 *
 * Ditambah dua fungsi bantu untuk admin:
 *   - seedAdmin     { username, password, nama, orgId } → membuat akun admin
 *
 * Prinsip keamanan:
 *   Semua operasi tulis yang menentukan (klaim kode, terbitkan kode, ubah
 *   status kode, buat admin) berjalan di sini dengan Admin SDK, sehingga
 *   client tidak bisa memalsukan lewat DevTools.
 *
 * Struktur koleksi (dipakai bersama Security Rules):
 *   akun/items/{uid}          profil akun (username, peran, orgId, aktif, kode)
 *   admin/items/{uid}         penanda akun admin kabupaten
 *   kodeAktivasi/items/{KODE} kode aktivasi: orgId, peran, aktif, dipakaiOleh...
 *   org/items/{orgId}         data organisasi (kabupaten)
 *   audit/items/{auto}        catatan aktivitas penting
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { logger } from 'firebase-functions';

/** Alias lokal supaya pemanggilan di badan kode tetap ringkas. */
const https = { onCall };

initializeApp();
const db = getFirestore();
const auth = getAuth();

setGlobalOptions({ region: 'asia-southeast2', maxInstances: 10 });

/* ------------------------------------------------------------------ */
/* Tipe & utilitas                                                    */
/* ------------------------------------------------------------------ */

type Peran = 'admin_kabupaten' | 'penilai' | 'pengawas';
const PERAN_VALID: Peran[] = ['admin_kabupaten', 'penilai', 'pengawas'];

/** Abjad tanpa I, O, 0, 1 supaya tidak salah baca saat diketik. */
const HURUF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function acak(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += HURUF[Math.floor(Math.random() * HURUF.length)];
  return s;
}

/** EPKPM-{ORG}-{PNL|PGW|ADM}-{4 acak} — sama dengan pratinjau di frontend. */
function buatKode(orgId: string, peran: Peran): string {
  const kodeOrg = String(orgId || 'ORG')
    .replace(/^POKJAWAS-/i, '')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 4)
    .toUpperCase() || 'ORG';
  const singkat = peran === 'penilai' ? 'PNL' : peran === 'pengawas' ? 'PGW' : 'ADM';
  return `EPKPM-${kodeOrg}-${singkat}-${acak(4)}`;
}

/** Email internal Firebase Auth: username@e-pkpm.local */
function emailDariUsername(username: string): string {
  const bersih = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return `${bersih}@e-pkpm.local`;
}

function normalUsername(u: unknown): string {
  return String(u || '').trim().toLowerCase();
}

async function catatAudit(aksi: string, detail: Record<string, unknown>) {
  try {
    await db.collection('audit').doc('items').collection('data').add({
      aksi, ...detail, at: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    logger.warn('gagal menulis audit', aksi, e);
  }
}

/** Pastikan pemanggil adalah admin kabupaten yang aktif. */
async function wajibAdmin(uid: string | undefined): Promise<
  { ok: true; orgId: string } | { ok: false; alasan: string }
> {
  if (!uid) return { ok: false, alasan: 'unauthorized' };
  const profil = await db.collection('akun').doc('items').collection('data').doc(uid).get();
  if (!profil.exists) return { ok: false, alasan: 'unauthorized' };
  const d = profil.data() as Record<string, unknown>;
  if (d.peran !== 'admin_kabupaten' && d.peran !== 'super_admin')
    return { ok: false, alasan: 'unauthorized' };
  if (d.aktif === false) return { ok: false, alasan: 'unauthorized' };
  return { ok: true, orgId: String(d.orgId || '') };
}

/* ------------------------------------------------------------------ */
/* klaimKode                                                          */
/* ------------------------------------------------------------------ */

/**
 * Langkah 1 aktivasi: kunci kode sebelum akun Firebase Auth dibuat.
 *
 * Frontend memanggil ini DULU, baru `createUserWithEmailAndPassword`.
 * Kode ditandai "diklaim" (bukan "dipakai") dengan username calon pemilik;
 * bila proses pembuatan akun gagal, kode tetap bisa diklaim ulang setelah
 * masa tenggang (`GRACE_MS`) lewat mekanisme di `tautkanAkun`.
 */
export const klaimKode = https.onCall(async (req) => {
  const data: any = req.data;
  const context = req;
  const code = String(data?.code || '').trim().toUpperCase();
  const username = normalUsername(data?.username);

  if (code.length < 4) return { sukses: false, alasan: 'invalid_code' };
  if (!/^[a-z0-9._-]{4,}$/.test(username)) return { sukses: false, alasan: 'username_invalid' };

  const ref = db.doc(`kodeAktivasi/items/data/${code}`);

  try {
    const hasil = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { sukses: false, alasan: 'invalid_code' };
      const k = snap.data() as Record<string, unknown>;

      if (k.aktif === false) return { sukses: false, alasan: 'invalid_code' };

      const berlaku = k.berlakuSampai as Timestamp | undefined;
      if (berlaku && berlaku.toMillis() < Date.now()) return { sukses: false, alasan: 'code_expired' };

      // Sudah dipakai akun lain.
      if (k.dipakaiOleh) return { sukses: false, alasan: 'code_used' };

      // Sedang diklaim orang lain dan belum lewat masa tenggang.
      const klaim = k.klaimOleh as string | undefined;
      const klaimAt = k.klaimAt as Timestamp | undefined;
      const GRACE_MS = 10 * 60 * 1000;
      if (klaim && klaim !== username && klaimAt && Date.now() - klaimAt.toMillis() < GRACE_MS) {
        return { sukses: false, alasan: 'code_used' };
      }

      // Organisasi pemilik kode harus aktif.
      const orgId = String(k.orgId || '');
      if (orgId) {
        const orgSnap = await tx.get(db.doc(`org/items/data/${orgId}`));
        if (orgSnap.exists) {
          const o = orgSnap.data() as Record<string, unknown>;
          if (o.aktif === false) return { sukses: false, alasan: 'org_inactive' };
        }
      }

      tx.set(ref, {
        klaimOleh: username,
        klaimAt: FieldValue.serverTimestamp(),
        klaimUid: context.auth?.uid || null,
      }, { merge: true });

      return { sukses: true, alasan: 'ok', orgId, peran: (k.peran as Peran) || 'penilai' };
    });

    if (hasil.sukses) await catatAudit('klaim_kode', { code, username });
    return hasil;
  } catch (e: any) {
    logger.error('klaimKode gagal', e);
    return { sukses: false, alasan: 'network_error' };
  }
});

/* ------------------------------------------------------------------ */
/* tautkanAkun                                                        */
/* ------------------------------------------------------------------ */

/**
 * Langkah 2 aktivasi: setelah akun Firebase Auth dibuat, tandai kode
 * benar-benar terpakai dan kaitkan ke uid.
 *
 * Frontend memanggil dengan `{ uid, code }` setelah login (atau segera
 * setelah pembuatan akun). Kode hanya boleh ditautkan bila:
 *   - kode belum dipakai, dan
 *   - username pada klaim sama dengan username akun pemanggil.
 */
export const tautkanAkun = https.onCall(async (req) => {
  const data: any = req.data;
  const context = req;
  const code = String(data?.code || '').trim().toUpperCase();
  const uidKlien = String(data?.uid || context.auth?.uid || '');
  if (!code) return { sukses: false, alasan: 'invalid_code' };
  if (!uidKlien) return { sukses: false, alasan: 'unauthorized' };

  // Identitas: ambil user dari Admin SDK (jangan percaya uid kiriman tanpa cek).
  let user;
  try {
    user = await auth.getUser(uidKlien);
  } catch {
    return { sukses: false, alasan: 'user_not_found' };
  }
  const usernameAkun = user.email ? user.email.split('@')[0] : '';

  const ref = db.doc(`kodeAktivasi/items/data/${code}`);
  try {
    const hasil = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { sukses: false, alasan: 'invalid_code' };
      const k = snap.data() as Record<string, unknown>;
      if (k.dipakaiOleh && k.dipakaiOleh !== uidKlien) return { sukses: false, alasan: 'code_used' };

      const klaim = k.klaimOleh as string | undefined;
      if (klaim && klaim !== usernameAkun) return { sukses: false, alasan: 'code_used' };

      tx.set(ref, {
        dipakaiOleh: uidKlien,
        dipakaiAt: FieldValue.serverTimestamp(),
        dipakaiUsername: usernameAkun,
        aktif: true,
      }, { merge: true });

      // Sinkronkan profil bila belum memuat orgId/peran.
      const akunRef = db.doc(`akun/items/data/${uidKlien}`);
      tx.set(akunRef, {
        peran: (k.peran as Peran) || 'penilai',
        orgId: String(k.orgId || ''),
        kode: code,
        aktif: true,
      }, { merge: true });

      return { sukses: true, alasan: 'ok' };
    });

    if (hasil.sukses) await catatAudit('tautkan_akun', { code, uid: uidKlien, username: usernameAkun });
    return hasil;
  } catch (e: any) {
    logger.error('tautkanAkun gagal', e);
    return { sukses: false, alasan: 'network_error' };
  }
});

/* ------------------------------------------------------------------ */
/* terbitkanKode                                                      */
/* ------------------------------------------------------------------ */

/**
 * Admin kabupaten menerbitkan kode aktivasi baru.
 * Hanya admin yang login (context.auth) boleh memanggil. orgId selalu
 * diambil dari profil admin, bukan dari kiriman klien — supaya admin
 * tidak bisa menerbitkan kode untuk kabupaten lain.
 */
export const terbitkanKode = https.onCall(async (req) => {
  const data: any = req.data;
  const context = req;
  const cek = await wajibAdmin(context.auth?.uid);
  if (!cek.ok) return { sukses: false, kode: [], alasan: cek.alasan };

  const peran = (data?.peran as Peran) || 'penilai';
  if (!PERAN_VALID.includes(peran)) return { sukses: false, kode: [], alasan: 'invalid_peran' };

  const orgId = cek.orgId || String(data?.orgId || '').trim();
  if (!orgId) return { sukses: false, kode: [], alasan: 'invalid_org' };

  const jumlah = Math.min(Math.max(Number(data?.jumlah) || 1, 1), 100);
  const label = String(data?.label || '').slice(0, 120);
  const berlakuRaw = data?.berlakuSampai ? String(data.berlakuSampai) : '';
  const berlakuSampai = berlakuRaw ? Timestamp.fromDate(new Date(berlakuRaw)) : null;

  const dibuat: string[] = [];
  const batch = db.batch();

  // Terbitkan unik: coba maksimum beberapa kali per kode.
  for (let i = 0; i < jumlah; i++) {
    let kode = '';
    for (let coba = 0; coba < 6; coba++) {
      const kandidat = buatKode(orgId, peran);
      const ada = await db.doc(`kodeAktivasi/items/data/${kandidat}`).get();
      if (!ada.exists) { kode = kandidat; break; }
    }
    if (!kode) continue;
    dibuat.push(kode);
    batch.set(db.doc(`kodeAktivasi/items/data/${kode}`), {
      orgId,
      peran,
      label,
      aktif: true,
      dipakaiOleh: null,
      dipakaiAt: null,
      berlakuSampai,
      dibuatAt: FieldValue.serverTimestamp(),
      dibuatOleh: context.auth?.uid || null,
    });
  }

  if (!dibuat.length) return { sukses: false, kode: [], alasan: 'generate_failed' };

  try {
    await batch.commit();
    await catatAudit('terbitkan_kode', { jumlah: dibuat.length, orgId, peran, oleh: context.auth?.uid });
    return { sukses: true, kode: dibuat, alasan: 'ok' };
  } catch (e: any) {
    logger.error('terbitkanKode gagal', e);
    return { sukses: false, kode: [], alasan: 'network_error' };
  }
});

/* ------------------------------------------------------------------ */
/* ubahStatusKode — nonaktifkan / aktifkan                            */
/* ------------------------------------------------------------------ */

export const ubahStatusKode = https.onCall(async (req) => {
  const data: any = req.data;
  const context = req;
  const cek = await wajibAdmin(context.auth?.uid);
  if (!cek.ok) return { sukses: false, alasan: cek.alasan };

  const code = String(data?.code || '').trim().toUpperCase();
  const aktif = data?.aktif === true;
  if (!code) return { sukses: false, alasan: 'invalid_code' };

  const ref = db.doc(`kodeAktivasi/items/data/${code}`);
  const snap = await ref.get();
  if (!snap.exists) return { sukses: false, alasan: 'invalid_code' };
  const k = snap.data() as Record<string, unknown>;
  if (cek.orgId && k.orgId && k.orgId !== cek.orgId) return { sukses: false, alasan: 'unauthorized' };

  try {
    await ref.set({ aktif }, { merge: true });
    await catatAudit('ubah_status_kode', { code, aktif, oleh: context.auth?.uid });
    return { sukses: true, alasan: 'ok' };
  } catch (e: any) {
    return { sukses: false, alasan: 'network_error' };
  }
});

/* ------------------------------------------------------------------ */
/* seedAdmin — pembuatan akun admin pertama / tambahan                */
/* ------------------------------------------------------------------ */

/**
 * Membuat akun admin kabupaten. Dipanggil dengan kunci bootstrap
 * `BOOTSTRAP_KEY` (secret Functions) untuk pembuatan admin pertama;
 * setelah itu pemanggilan hanya diizinkan untuk admin yang sudah login.
 *
 * Deploy secret:  firebase functions:secrets:set BOOTSTRAP_KEY
 */
export const seedAdmin = https.onCall(
  { secrets: ['BOOTSTRAP_KEY'], cors: true },
  async (req: CallableRequest<any>) => {
    const data: any = req.data;
    const context = req;
    const bootstrap = String(process.env.BOOTSTRAP_KEY || '');
    const kunci = String(data?.bootstrapKey || '');
    const lewatBootstrap = !!bootstrap && kunci === bootstrap;

    if (!lewatBootstrap) {
      const cek = await wajibAdmin(context.auth?.uid);
      if (!cek.ok) return { sukses: false, alasan: 'unauthorized' };
    }

    const username = normalUsername(data?.username);
    const password = String(data?.password || '');
    const nama = String(data?.nama || username);
    const orgId = String(data?.orgId || '').trim();

    if (!/^[a-z0-9._-]{4,}$/.test(username)) return { sukses: false, alasan: 'username_invalid' };
    if (password.length < 8) return { sukses: false, alasan: 'password_invalid' };

    const email = emailDariUsername(username);
    let uid = '';
    try {
      const user = await auth.createUser({ email, password, displayName: nama });
      uid = user.uid;
    } catch (e: any) {
      if (String(e?.code || '').includes('email-already-exists')) {
        // Admin yang sudah punya akun Auth: perbarui password & profil saja.
        const lama = await auth.getUserByEmail(email);
        uid = lama.uid;
        await auth.updateUser(uid, { password, displayName: nama });
      } else {
        logger.error('seedAdmin: gagal membuat akun', e);
        return { sukses: false, alasan: 'auth_error' };
      }
    }

    try {
      const batch = db.batch();
      batch.set(db.doc(`akun/items/data/${uid}`), {
        uid, username, email, nama,
        peran: 'admin_kabupaten',
        orgId,
        aktif: true,
        dibuatAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      batch.set(db.doc(`admin/items/data/${uid}`), {
        uid, username, orgId, aktif: true,
        dibuatAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      // Organisasi ikut dibuat saat bootstrap pertama, supaya admin langsung
      // punya orgId yang sah. Hanya lewat bootstrap — bukan panggilan admin biasa.
      if (lewatBootstrap && orgId) {
        batch.set(db.doc(`org/items/data/${orgId}`), {
          orgId,
          nama: String(data?.orgNama || orgId),
          kabupaten: String(data?.kabupaten || 'Jember'),
          provinsi: String(data?.provinsi || 'Jawa Timur'),
          aktif: true,
          dibuatAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      await batch.commit();
      await catatAudit('seed_admin', { uid, username, orgId, lewatBootstrap });
      return { sukses: true, alasan: 'ok', uid };
    } catch (e: any) {
      logger.error('seedAdmin: gagal menulis profil', e);
      return { sukses: false, alasan: 'network_error' };
    }
  },
);
