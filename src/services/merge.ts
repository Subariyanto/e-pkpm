/**
 * Penggabungan (merge) data antar perangkat — Opsi A.
 *
 * Data penilaian disimpan lokal di IndexedDB masing-masing perangkat. Untuk
 * menyatukan hasil kerja beberapa perangkat (mis. laptop + HP), backup dari
 * perangkat lain ditimpa-ulang ke data lokal dengan aturan:
 *
 *   - TIDAK ADA data lokal yang dihapus.
 *   - Data master digabung berdasarkan `id`.
 *   - Penilaian digabung berdasarkan kunci alami supervisorId + indicatorId.
 *   - Bila terjadi konflik (record sama, isi berbeda), dikembalikan sebagai
 *     daftar konflik untuk diputuskan manual oleh pengguna — bukan dipilih
 *     otomatis.
 *   - Audit log selalu ditambahkan, tidak pernah ditimpa.
 *
 * Modul ini sengaja tidak menyentuh `restore()` yang bersifat mengganti.
 */
import { db, audit } from '../lib/db';

export type MergeStrategy = 'newest' | 'manual';

export interface ConflictItem {
  /** Nama tabel Dexie. */
  table: string;
  /** Kunci primer / kunci alami record. */
  key: string;
  /** Label manusiawi untuk ditampilkan di UI. */
  label: string;
  /** Versi yang sudah ada di perangkat ini. */
  local: Record<string, unknown>;
  /** Versi yang datang dari file backup. */
  incoming: Record<string, unknown>;
}

export interface MergePreview {
  /** Jumlah record yang akan ditambahkan (belum ada di lokal). */
  toAdd: Record<string, number>;
  /** Jumlah record yang akan diperbarui otomatis (pemilik timestamp lebih baru). */
  toUpdate: Record<string, number>;
  /** Record yang isinya berbeda dan butuh keputusan manual. */
  conflicts: ConflictItem[];
  /** Record yang isinya identik, tidak perlu diapa-apakan. */
  identical: number;
  /** Ringkasan total. */
  total: number;
}

/** Tabel yang selalu ditambahkan, tidak pernah dibandingkan isinya. */
const APPEND_ONLY = new Set(['audits', 'imports']);

/** Tabel yang tidak ikut digabung dari file backup. */
const SKIP_TABLES = new Set(['activation', 'settings']);

/**
 * Kunci alami per tabel. Dipakai untuk menentukan apakah dua record
 * "mewakili hal yang sama" walau id-nya berbeda (mis. dibuat di dua perangkat).
 */
const NATURAL_KEY: Record<string, (r: any) => string | null> = {
  assessments: (r) => (r.supervisorId && r.indicatorId ? `p:${r.supervisorId}#${r.indicatorId}` : null),
  results: (r) => (r.supervisorId && r.periodId ? `p:${r.supervisorId}@${r.periodId}` : null),
  supervisors: (r) => (r.nip ? `nip:${r.nip}` : null),
  users: (r) => (r.username ? `user:${r.username}` : null),
  indicators: (r) => (r.code ? `code:${r.code}` : null),
  regulasi: (r) => (r.nomor ? `nomor:${r.nomor}` : null),
  regulations: (r) => (r.nomor || r.number ? `nomor:${r.nomor || r.number}` : null),
  periods: (r) => (r.year ? `year:${r.year}` : null),
};

/**
 * Menyusun peta id: id dari file backup → id yang dipakai di perangkat ini.
 *
 * Setiap perangkat membuat UUID sendiri untuk pengawas yang sama. Bila tidak
 * disamakan, penilaian dari penilai B akan menunjuk pengawas yang tidak ada di
 * perangkat Ketua Pokjawas (baris yatim) dan satu orang tampil dua kali.
 * Pencocokan memakai kunci alami: NIP untuk pengawas, username untuk akun.
 */
async function buildIdMaps(payload: any) {
  const supMap: Record<string, string> = {};
  const userMap: Record<string, string> = {};

  const rows: any[] = payload?.data?.supervisors || [];
  if (Array.isArray(rows) && rows.length) {
    const lokal = await db.supervisors.toArray();
    const byId = new Map(lokal.map(r => [r.id, r]));
    const byNip = new Map(lokal.filter(r => r.nip).map(r => [r.nip, r]));
    for (const r of rows) {
      const match = (r.id && byId.get(r.id)) || (r.nip ? byNip.get(r.nip) : undefined);
      if (r.id) supMap[r.id] = match ? match.id : r.id;
    }
  }

  const uRows: any[] = payload?.data?.users || [];
  if (Array.isArray(uRows) && uRows.length) {
    const lokal = await db.users.toArray();
    const byId = new Map(lokal.map(r => [r.id, r]));
    const byName = new Map(lokal.filter(r => r.username).map(r => [String(r.username).toLowerCase(), r]));
    for (const r of uRows) {
      const match = (r.id && byId.get(r.id)) ||
        (r.username ? byName.get(String(r.username).toLowerCase()) : undefined);
      if (r.id) userMap[r.id] = match ? match.id : r.id;
    }
  }

  return { supMap, userMap };
}

/**
 * Menyesuaikan rujukan antar tabel pada record yang datang dari backup:
 * supervisorId / assessorId / id penilaian ditulis ulang memakai id lokal.
 */
function remapRow(table: string, r: any, maps: { supMap: Record<string, string>; userMap: Record<string, string> }) {
  if (!r || typeof r !== 'object') return r;
  const out: any = { ...r };
  if (out.supervisorId && maps.supMap[out.supervisorId]) out.supervisorId = maps.supMap[out.supervisorId];
  if (out.assessorId && maps.userMap[out.assessorId]) out.assessorId = maps.userMap[out.assessorId];
  if ((table === 'assessments' || table === 'results') && out.supervisorId) {
    if (table === 'assessments' && out.indicatorId) out.id = `${out.supervisorId}-${out.indicatorId}`;
    if (table === 'results') out.id = `2026-${out.supervisorId}`;
  }
  return out;
}

/** Timestamp untuk membandingkan kebaruan; 0 bila tidak tersedia. */
function stamp(r: any): number {
  const raw = r?.updatedAt || r?.at || r?.activationDate || r?.lastCheck || r?.createdAt;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

/** Perbandingan isi record tanpa memperhitungkan timestamp. */
function sameContent(a: any, b: any): boolean {
  const strip = (o: any) => {
    const c = { ...o };
    delete c.updatedAt;
    delete c.at;
    delete c.lastCheck;
    delete c.checkedAt;
    return c;
  };
  try {
    return JSON.stringify(strip(a), Object.keys(strip(a)).sort()) ===
           JSON.stringify(strip(b), Object.keys(strip(b)).sort());
  } catch {
    return false;
  }
}

/** Label singkat untuk ditampilkan di daftar konflik. */
function labelOf(table: string, r: any): string {
  switch (table) {
    case 'supervisors': return r.name || r.nip || r.id;
    case 'users': return r.name || r.username || r.id;
    case 'indicators': return `${r.code || ''} ${r.title || r.description || ''}`.trim() || r.id;
    case 'assessments': return `${r.supervisorId || ''} · ${r.indicatorId || ''} · skor ${r.score ?? '—'}`;
    case 'results': return `${r.supervisorId || ''} · nilai ${r.finalScore ?? '—'}`;
    case 'regulasi':
    case 'regulations': return r.nomor || r.number || r.id;
    default: return r.id || '—';
  }
}

/**
 * Membaca file backup dan menghitung rencana penggabungan.
 * Tidak mengubah database sama sekali — hanya membaca.
 */
/**
 * Membaca file backup dan menghitung rencana penggabungan.
 * Tidak mengubah database sama sekali — hanya membaca.
 */
export async function planMerge(file: File): Promise<{ preview: MergePreview; payload: any }> {
  let obj: any;
  try {
    obj = JSON.parse(await file.text());
  } catch {
    throw new Error('File tidak dapat dibaca sebagai JSON. Pastikan file backup tidak rusak.');
  }
  return planMergePayload(obj);
}

/**
 * Sama seperti `planMerge`, tetapi menerima objek backup yang sudah dibaca.
 * Dipakai saat beberapa file digabung dulu menjadi satu payload.
 */
export async function planMergePayload(obj: any): Promise<{ preview: MergePreview; payload: any }> {
  if (obj?.packageType !== 'BACKUP') {
    throw new Error('File ini bukan backup lengkap. Gunakan file hasil menu "Backup Seluruh Data".');
  }
  const org = await db.org.toCollection().first();
  if (org && obj.organizationId && obj.organizationId !== org.id) {
    throw new Error(`Backup berasal dari organisasi lain (${obj.organizationId}). Merge dibatalkan.`);
  }

  const preview: MergePreview = { toAdd: {}, toUpdate: {}, conflicts: [], identical: 0, total: 0 };
  const data: Record<string, any[]> = obj.data || {};
  const maps = await buildIdMaps(obj);

  for (const [tableName, rowsRaw] of Object.entries(data)) {
    if (!Array.isArray(rowsRaw)) continue;
    if (SKIP_TABLES.has(tableName)) continue;
    const table = (db as any)[tableName];
    if (!table) continue;
    const rows = rowsRaw.map(r => remapRow(tableName, r, maps));

    if (APPEND_ONLY.has(tableName)) {
      // Audit log: hitung berapa entri baru (yang belum ada, dinilai dari waktu+aksi+objek).
      const existing = await table.toArray();
      const seen = new Set(existing.map((r: any) => `${r.at}|${r.action}|${r.object}`));
      const fresh = rows.filter((r: any) => !seen.has(`${r.at}|${r.action}|${r.object}`));
      if (fresh.length) preview.toAdd[tableName] = (preview.toAdd[tableName] || 0) + fresh.length;
      preview.total += fresh.length;
      continue;
    }

    const localRows = await table.toArray();
    const localById = new Map<string, any>(localRows.map((r: any) => [r.id, r]));
    const keyOf = NATURAL_KEY[tableName];
    const localByKey = new Map<string, any>();
    if (keyOf) {
      for (const r of localRows) {
        const k = keyOf(r);
        if (k) localByKey.set(k, r);
      }
    }

    for (const incoming of rows) {
      const nat = keyOf ? keyOf(incoming) : null;
      const match = (incoming.id && localById.get(incoming.id)) || (nat ? localByKey.get(nat) : undefined);

      if (!match) {
        preview.toAdd[tableName] = (preview.toAdd[tableName] || 0) + 1;
        preview.total++;
        continue;
      }

      if (sameContent(match, incoming)) {
        preview.identical++;
        continue;
      }

      // Isi berbeda. Tentukan pemenang berdasarkan timestamp, sisanya jadi konflik.
      const tLocal = stamp(match);
      const tIncoming = stamp(incoming);
      if (tIncoming > tLocal) {
        preview.toUpdate[tableName] = (preview.toUpdate[tableName] || 0) + 1;
      } else if (tLocal === tIncoming) {
        // Tidak ada penanda waktu yang bisa diandalkan — serahkan ke pengguna.
        preview.conflicts.push({
          table: tableName,
          key: match.id,
          label: labelOf(tableName, incoming),
          local: match,
          incoming,
        });
      } else {
        // Lokal lebih baru; tetap dicatat agar pengguna tahu ada perbedaan.
        preview.conflicts.push({
          table: tableName,
          key: match.id,
          label: labelOf(tableName, incoming),
          local: match,
          incoming,
        });
      }
      preview.total++;
    }
  }

  return { preview, payload: obj };
}

export interface MergeOptions {
  /** new = menangkan data dari file; local = pertahankan data perangkat ini. */
  defaultResolution: 'new' | 'local';
  /** Keputusan khusus per konflik, kunci: `${table}::${key}`. */
  resolutions?: Record<string, 'new' | 'local'>;
  /**
   * Simpan cadangan pengaman sebelum menulis. Default true.
   * Saat menggabung beberapa file berturut-turut, cukup sekali di awal
   * (file berikutnya dikirim `false`) supaya tidak menumpuk cadangan besar.
   */
  safetyBackup?: boolean;
}

export interface MergeResult {
  added: number;
  updated: number;
  keptLocal: number;
  skipped: number;
  perTable: Record<string, { added: number; updated: number }>;
}

/**
 * Menjalankan penggabungan. Backup otomatis dibuat sebelum menulis.
 */
export async function runMerge(payload: any, options: MergeOptions): Promise<MergeResult> {
  // Backup pengaman sebelum menyentuh data.
  if (options.safetyBackup !== false) {
    const safety: Record<string, unknown> = {};
    for (const t of db.tables) safety[t.name] = await t.toArray();
    await db.settings.put({ key: `mergeBackup_${Date.now()}`, value: safety });
  }

  const result: MergeResult = { added: 0, updated: 0, keptLocal: 0, skipped: 0, perTable: {} };
  const data: Record<string, any[]> = payload.data || {};
  const resolutions = options.resolutions || {};
  const maps = await buildIdMaps(payload);

  for (const [tableName, rowsRaw] of Object.entries(data)) {
    if (!Array.isArray(rowsRaw)) continue;
    if (SKIP_TABLES.has(tableName)) continue;
    const table = (db as any)[tableName];
    if (!table) continue;
    const rows = rowsRaw.map(r => remapRow(tableName, r, maps));
    result.perTable[tableName] = result.perTable[tableName] || { added: 0, updated: 0 };

    if (APPEND_ONLY.has(tableName)) {
      const existing = await table.toArray();
      const seen = new Set(existing.map((r: any) => `${r.at}|${r.action}|${r.object}`));
      const fresh = rows.filter((r: any) => !seen.has(`${r.at}|${r.action}|${r.object}`));
      if (fresh.length) {
        await table.bulkAdd(fresh);
        result.perTable[tableName].added += fresh.length;
        result.added += fresh.length;
      }
      continue;
    }

    const localRows = await table.toArray();
    const localById = new Map<string, any>(localRows.map((r: any) => [r.id, r]));
    const keyOf = NATURAL_KEY[tableName];
    const localByKey = new Map<string, any>();
    if (keyOf) {
      for (const r of localRows) {
        const k = keyOf(r);
        if (k) localByKey.set(k, r);
      }
    }

    const toPut: any[] = [];
    for (const incoming of rows) {
      const nat = keyOf ? keyOf(incoming) : null;
      const match = (incoming.id && localById.get(incoming.id)) || (nat ? localByKey.get(nat) : undefined);

      if (!match) {
        // Pertahankan id asli bila belum dipakai; aman untuk bulkPut.
        toPut.push(incoming);
        continue;
      }

      if (sameContent(match, incoming)) {
        result.skipped++;
        continue;
      }

      const tLocal = stamp(match);
      const tIncoming = stamp(incoming);
      let winner: 'new' | 'local';

      if (tIncoming === tLocal) {
        // Konflik sesungguhnya — pakai keputusan pengguna.
        winner = resolutions[`${tableName}::${match.id}`] || options.defaultResolution;
      } else {
        winner = tIncoming > tLocal ? 'new' : 'local';
        // Pengguna tetap boleh menimpa keputusan timestamp.
        winner = resolutions[`${tableName}::${match.id}`] || winner;
      }

      if (winner === 'new') {
        // Simpan dengan id lokal agar relasi antar tabel tidak putus.
        toPut.push({ ...incoming, id: match.id });
        result.perTable[tableName].updated++;
        result.updated++;
      } else {
        result.keptLocal++;
      }
    }

    if (toPut.length) await table.bulkPut(toPut);
    for (const r of toPut) {
      if (localById.has(r.id)) { /* sudah dihitung */ } else {
        result.perTable[tableName].added++;
        result.added++;
      }
    }
  }

  await audit('MERGE', 'Database', result);
  return result;
}

/** Ringkasan rencana merge untuk ditampilkan di UI. */
export function summarize(preview: MergePreview): string {
  const add = Object.values(preview.toAdd).reduce((a, b) => a + b, 0);
  const upd = Object.values(preview.toUpdate).reduce((a, b) => a + b, 0);
  return `${add} data baru · ${upd} akan diperbarui · ${preview.conflicts.length} perlu keputusan · ${preview.identical} sama`;
}

export { APPEND_ONLY, SKIP_TABLES, NATURAL_KEY };
