/**
 * Lapisan cloud Firebase untuk e-PKPM — mode hybrid (offline-first).
 *
 * Prinsip kerja:
 *  1. IndexedDB (Dexie) TETAP menjadi sumber utama saat aplikasi dipakai.
 *     Aplikasi tidak berubah perilaku bila Firebase belum dikonfigurasi.
 *  2. Bila konfigurasi Firebase tersedia (dari `.env` atau diisi lewat menu
 *     "Sinkron Cloud"), data lokal dapat didorong (push) ke Firestore dan
 *     ditarik (pull) kembali ke perangkat.
 *  3. Penyimpanan awan yang dipakai adalah koleksi datar:
 *       kek/{tabel}/items/{id}  → satu dokumen = satu record utuh
 *     Ini sengaja dipilih ketimbang struktur relasional bertingkat karena
 *     pemakaian aplikasi hanya sekali setahun: payload kecil per record,
 *     mudah di-backup, dan mudah dihitung biaya bacanya.
 *
 * Catatan kuota (Spark/gratis): 50.000 baca & 20.000 tulis per hari.
 * Satu siklus sinkronisasi penuh hanya butuh ±jumlah-record baca/tulis,
 * sehingga pemakaian tahunan sangat jauh di bawah kuota.
 */
import type { PKPMDatabase } from '../lib/db';

/** Koleksi yang tidak perlu naik ke awan (sensitif / perangkat). */
const LOKAL_SAJA = new Set(['settings', 'activation', 'activationCodes', 'imports']);

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

export interface SyncInfo {
  online: boolean;
  projectId?: string;
  /** Jumlah dokumen per koleksi hasil pemeriksaan terakhir. */
  remoteCounts?: Record<string, number>;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  skipped: number;
  durasiMs: number;
  pesan: string;
}

const KONFIG_KEY = 'firebaseConfig';
const SNAPSHOT_TARGET = 380; // rerata byte batas aman per dokumen (lihat catatan di bawah)

/* ------------------------------------------------------------------ */
/* Konfigurasi                                                        */
/* ------------------------------------------------------------------ */

/** Ambil konfigurasi dari env build (Vite) bila ada, lalu dari localStorage. */
export function konfigAktif(): FirebaseConfig | null {
  const env = (globalThis as any).__FIREBASE_ENV__ as Partial<FirebaseConfig> | undefined;
  if (env?.apiKey && env?.projectId) return env as FirebaseConfig;
  try {
    const raw = localStorage.getItem(KONFIG_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as FirebaseConfig;
    return obj?.apiKey && obj?.projectId ? obj : null;
  } catch {
    return null;
  }
}

export function simpanKonfig(cfg: FirebaseConfig | null) {
  if (!cfg) localStorage.removeItem(KONFIG_KEY);
  else localStorage.setItem(KONFIG_KEY, JSON.stringify(cfg));
}

/** Terjemahkan env Vite (VITE_FIREBASE_*) ke bentuk konfigurasi. */
export function konfigDariEnv(): FirebaseConfig | null {
  const e = import.meta.env as Record<string, string | undefined>;
  if (!e.VITE_FIREBASE_API_KEY || !e.VITE_FIREBASE_PROJECT_ID) return null;
  return {
    apiKey: e.VITE_FIREBASE_API_KEY,
    authDomain: e.VITE_FIREBASE_AUTH_DOMAIN || `${e.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: e.VITE_FIREBASE_PROJECT_ID,
    appId: e.VITE_FIREBASE_APP_ID || '',
    storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: e.VITE_FIREBASE_SENDER_ID,
  };
}

/* ------------------------------------------------------------------ */
/* Muat modul firebase hanya bila dipakai (code-splitting)            */
/* ------------------------------------------------------------------ */

let modulCache: any = null;
let dbCache: { cfg: FirebaseConfig; db: any } | null = null;

async function modul() {
  if (modulCache) return modulCache;
  const app = await import('firebase/app');
  const firestore = await import('firebase/firestore');
  const compat = await import('firebase/compat/app');
  modulCache = { app, firestore, compat };
  return modulCache;
}

async function firestoreUntuk(cfg: FirebaseConfig) {
  if (dbCache && dbCache.cfg.projectId === cfg.projectId) return dbCache.db;
  const { app, firestore, compat } = await modul();
  const apps = app.getApps();
  const inst = apps.length ? app.getApp() : app.initializeApp(cfg);
  // Persistensi IndexedDB bawaan Firestore memungkinkan tulis-baca saat offline.
  try {
    await firestore.enableIndexedDbPersistence(inst);
  } catch {
    /* sudah aktif / tab lain memegang lock — abaikan */
  }
  const db = firestore.getFirestore(inst);
  dbCache = { cfg, db };
  void compat; // dipakai untuk kompatibilitas antar-versi SDK
  return db;
}

/* ------------------------------------------------------------------ */
/* Pemetaan tabel ↔ koleksi                                           */
/* ------------------------------------------------------------------ */

/** Nama tabel Dexie → nama koleksi Firestore. */
function koleksi(tabel: string) { return tabel; }

/** Dokumen yang dianggap terlalu besar dipisah agar aman dari batas 1 MB. */
function perkecilRecord(rec: Record<string, unknown>) {
  const clone: Record<string, unknown> = { ...rec };
  const json = JSON.stringify(clone);
  if (json.length <= 200 * 1024) return { data: clone, split: false };
  // Pisahkan field besar ke peta `_chunk`, dokumen utama tetap kecil.
  const chunk: Record<string, string> = {};
  for (const [k, v] of Object.entries(clone)) {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    if (s && s.length > 20 * 1024) {
      chunk[k] = s;
      delete clone[k];
    }
  }
  clone._chunk = chunk;
  clone._split = true;
  return { data: clone, split: true };
}

function gabungRecord(rec: Record<string, unknown>) {
  if (!rec?._split || !rec._chunk) return rec;
  const out: Record<string, unknown> = { ...rec };
  const chunk = out._chunk as Record<string, string>;
  delete out._chunk;
  delete out._split;
  for (const [k, s] of Object.entries(chunk)) {
    try { out[k] = JSON.parse(s); } catch { out[k] = s; }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Push (lokal → awan)                                                */
/* ------------------------------------------------------------------ */

/**
 * Dorong isi database lokal ke Firestore.
 * Record yang isinya tidak berubah sejak sinkronisasi terakhir dilewati,
 * sehingga hemat kuota tulis.
 */
export async function pushKeAwan(database: PKPMDatabase, opsi?: { paksa?: boolean }): Promise<SyncResult> {
  const cfg = konfigAktif();
  if (!cfg) throw new Error('Konfigurasi Firebase belum diisi. Buka menu Sinkron Cloud lalu tempel konfigurasi project Firebase.');
  const t0 = Date.now();
  const { firestore } = await modul();
  const dbAwan = await firestoreUntuk(cfg);
  const { doc, setDoc, serverTimestamp } = firestore;

  let pushed = 0, skipped = 0;

  for (const tabel of database.tables) {
    if (LOKAL_SAJA.has(tabel.name)) continue;
    const rows = (await tabel.toArray()) as Record<string, unknown>[];
    // Bagi ke beberapa batch agar 1 batch ≤ 500 operasi (batas Firestore).
    const layak = rows.filter(r => {
      return r && (r.id !== undefined || tabel.name === 'audits');
    });
    for (let i = 0; i < layak.length; i += 400) {
      const bagian = layak.slice(i, i + 400);
      const refs: any[] = [];
      const payloads: Record<string, unknown>[] = [];
      for (const r of bagian) {
        const id = String(r.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        const hashBaru = ringkas(r);
        const kunciHash = `hash:${tabel.name}:${id}`;
        if (!opsi?.paksa && localStorage.getItem(kunciHash) === hashBaru) { skipped++; continue; }
        const { data } = perkecilRecord(r);
        refs.push(doc(dbAwan, koleksi(tabel.name), 'items', id));
        payloads.push({ ...data, id, _syncedAt: serverTimestamp() });
        localStorage.setItem(kunciHash, hashBaru);
      }
      if (!refs.length) continue;
      // setDoc satu per satu via batch tulis dari SDK modular memakai writeBatch
      const { writeBatch } = firestore;
      const batch = writeBatch(dbAwan);
      refs.forEach((ref, idx) => batch.set(ref, payloads[idx], { merge: true }));
      await batch.commit();
      pushed += refs.length;
    }
  }

  return {
    pushed, pulled: 0, skipped,
    durasiMs: Date.now() - t0,
    pesan: `${pushed} dokumen dikirim ke Firestore${skipped ? `, ${skipped} dilewati (tidak berubah)` : ''}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Pull (awan → lokal)                                                */
/* ------------------------------------------------------------------ */

/**
 * Tarik seluruh isi Firestore ke perangkat ini.
 * Mode default "gabung": record yang belum ada ditambahkan, record yang
 * sudah ada dibandingkan `_syncedAt` — yang awan lebih baru menimpa lokal.
 */
export async function pullDariAwan(database: PKPMDatabase, opsi?: { timpa?: boolean }): Promise<SyncResult> {
  const cfg = konfigAktif();
  if (!cfg) throw new Error('Konfigurasi Firebase belum diisi.');
  const t0 = Date.now();
  const { firestore } = await modul();
  const dbAwan = await firestoreUntuk(cfg);
  const { collection, getDocs } = firestore;

  let pulled = 0, skipped = 0;

  for (const tabel of database.tables) {
    if (LOKAL_SAJA.has(tabel.name)) continue;
    const snap = await getDocs(collection(dbAwan, koleksi(tabel.name), 'items'));
    const records: Record<string, unknown>[] = [];
    for (const d of snap.docs) {
      const raw = d.data() as Record<string, unknown>;
      records.push(gabungRecord(raw));
    }
    if (!records.length) continue;

    if (opsi?.timpa) {
      await tabel.clear();
      await tabel.bulkPut(records as any);
      pulled += records.length;
      continue;
    }

    // Gabung: bandingkan waktu sinkronisasi bila tersedia.
    const lokal = new Map<string, Record<string, unknown>>();
    for (const r of (await tabel.toArray()) as Record<string, unknown>[]) {
      const id = String(r.id ?? '');
      if (id) lokal.set(id, r);
    }
    const akhir: Record<string, unknown>[] = [];
    for (const r of records) {
      const id = String(r.id ?? '');
      const lama = id ? lokal.get(id) : undefined;
      if (!lama) { akhir.push(r); continue; }
      const waktuAwan = keWaktu(r._syncedAt);
      const waktuLokal = keWaktu((lama as any).updatedAt || (lama as any).finalizedAt || (lama as any).at);
      if (waktuAwan && waktuLokal && waktuAwan > waktuLokal) akhir.push(r);
      else skipped++;
    }
    if (akhir.length) {
      await tabel.bulkPut(akhir as any);
      pulled += akhir.length;
    }
  }

  return {
    pushed: 0, pulled, skipped,
    durasiMs: Date.now() - t0,
    pesan: `${pulled} dokumen ditarik dari Firestore${skipped ? `, ${skipped} dipertahankan versi lokal` : ''}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Diagnostik                                                         */
/* ------------------------------------------------------------------ */

export async function cekKoneksi(): Promise<SyncInfo> {
  const cfg = konfigAktif();
  if (!cfg) return { online: false };
  try {
    const { firestore } = await modul();
    const dbAwan = await firestoreUntuk(cfg);
    const { collection, getDocs, limit, query } = firestore;
    const probe = await getDocs(query(collection(dbAwan, 'madrasahs', 'items'), limit(1)));
    return { online: true, projectId: cfg.projectId, remoteCounts: { madrasahs: probe.size } };
  } catch (e: any) {
    return { online: false, projectId: cfg.projectId };
  }
}

/* ------------------------------------------------------------------ */
/* Utilitas                                                           */
/* ------------------------------------------------------------------ */

function ringkas(v: unknown) {
  const s = JSON.stringify(v);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}

function keWaktu(v: unknown): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? 0 : t; }
  if (typeof v === 'object' && v !== null && 'seconds' in (v as any)) return (v as any).seconds * 1000;
  return 0;
}
