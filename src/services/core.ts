import { db, audit } from '../lib/db';
import { indicators as newIndicators, supervisors, users, regulasiData, BOBOT_DEFAULT, PREDIKAT_DEFAULT } from '../data/demo';
import { indicatorsV2 } from '../data/instruments-v2';
import type { Assessment, Indicator, Result, PredikatRow, BobotKomponen, Jenjang } from '../types';

export async function sha256(v: string) {
  if (crypto?.subtle?.digest) {
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)))].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(v);
}

function sha256Fallback(s: string) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const bytes = new TextEncoder().encode(s);
  const l = bytes.length; const bitLen = l * 8;
  const padLen = (l + 9 >> 6) + 1 << 6;
  const data = new Uint8Array(padLen); data.set(bytes); data[l] = 0x80;
  const dv = new DataView(data.buffer);
  dv.setUint32(padLen - 4, bitLen >>> 0);
  dv.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000));
  const w = new Uint32Array(64);
  for (let i = 0; i < padLen; i += 4) w[i >> 2] = dv.getUint32(i);
  for (let i = 16; i < 64; i++) {
    const s0 = (w[i-15]>>>7|w[i-15]<<25)^(w[i-15]>>>18|w[i-15]<<14)^w[i-15]>>>3;
    const s1 = (w[i-2]>>>17|w[i-2]<<15)^(w[i-2]>>>19|w[i-2]<<13)^w[i-2]>>>10;
    w[i] = (w[i-16]+s0+w[i-7]+s1)>>>0;
  }
  let [a,b,c,d,e,f,g,h] = H;
  for (let i = 0; i < 64; i++) {
    const S1=(e>>>6|e<<26)^(e>>>11|e<<21)^(e>>>25|e<<7);
    const ch=(e&f)^(~e&g);
    const t1=(h+S1+ch+K[i]+w[i])>>>0;
    const S0=(a>>>2|a<<30)^(a>>>13|a<<19)^(a>>>22|a<<10);
    const maj=(a&b)^(a&c)^(b&c);
    const t2=(S0+maj)>>>0;
    h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
  }
  return [a,b,c,d,e,f,g,h].map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
}

/**
 * Pastikan butir instrumen baku PKPM selalu tersedia di perangkat.
 *
 * Dijalankan otomatis saat aplikasi dibuka sehingga daftar indikator di menu
 * Penilaian V2 selalu terisi, termasuk pada perangkat yang datanya belum
 * lengkap atau hasil impor paket lama (versi 'legacy'). Butir yang sudah ada
 * tidak diubah dan data penilaian tidak pernah dihapus.
 */
export async function ensureInstrumenBaku(): Promise<number> {
  const semua = await db.indicators.toArray();
  const kodeAda = new Set(semua.map(x => (x.code || '').toUpperCase().trim()).filter(Boolean));
  const baru = indicatorsV2.filter(x => !kodeAda.has((x.code || '').toUpperCase().trim()));
  if (!baru.length) return 0;
  await db.indicators.bulkPut(baru);
  await audit('SINKRON_INSTRUMEN', 'Instrumen baku', `${baru.length} butir dilengkapi otomatis`);
  return baru.length;
}

export async function seedDemo() {
  const pin = await sha256('123456');
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map(t => t.clear()));
    await db.org.add({
      id: 'ORG-JEMBER', name: 'Pokjawas Madrasah Kabupaten Jember',
      district: 'Kabupaten Jember', province: 'Jawa Timur',
      chairman: 'Drs. Ahmad Hidayat, M.Pd.', headOffice: 'Dr. H. Kepala Kantor, M.Pd.I.',
      address: 'Jl. Bengawan Solo, Jember', phone: '0331-000000',
      email: 'pokjawas@example.id', period: '2026',
    });
    await db.users.bulkAdd(users.map(u => ({ ...u, pinHash: pin })));
    await db.supervisors.bulkAdd(supervisors);
    await db.indicators.bulkAdd(newIndicators);
    await db.regulasi.bulkAdd(regulasiData);
    await db.periods.add({
      id: '2026', year: 2026, schoolYear: '2026/2027',
      start: '2026-01-01', end: '2026-12-31', status: 'active',
      instrumenVersi: 'pkpm-0-2-v2',
    });
    await db.settings.put({ key: 'predicates', value: PREDIKAT_DEFAULT });
    await db.settings.put({ key: 'bobotKomponen', value: BOBOT_DEFAULT });
    await db.settings.put({ key: 'mekanismePenilaian', value: 'individual' });
  });
  await audit('DATA_DEMO', 'Seluruh data', 'Aktif');
}

// Section K: Perhitungan Nilai
export function calculate(
  items: Assessment[],
  master: Indicator[],
  predicates?: PredikatRow[],
  bobot?: BobotKomponen,
) {
  const preds = predicates || PREDIKAT_DEFAULT;
  const w = bobot || BOBOT_DEFAULT;
  const totalW = (w.K1 || 0) + (w.K2 || 0) + (w.K3 || 0) + (w.K4 || 0);

  const components: Record<string, number> = {};
  const componentsConverted: Record<string, number> = {};

  for (const c of ['K1', 'K2', 'K3', 'K4'] as const) {
    const ins = master.filter(x => x.component === c && x.active);
    const applicable = ins.filter(i => {
      const a = items.find(x => x.indicatorId === i.id);
      return a && !a.na && a.score !== undefined;
    });
    if (!applicable.length) { components[c] = 0; componentsConverted[c] = 0; continue; }

    let sum = 0, tw = 0;
    for (const i of applicable) {
      const a = items.find(x => x.indicatorId === i.id)!;
      const nilai = (a.score! / i.maxScore) * 100;
      sum += nilai * i.weight;
      tw += i.weight;
    }
    const compScore = tw ? sum / tw : 0;
    components[c] = Math.round(compScore * 100) / 100;

    // Konversi komponen 0-4 untuk kompatibilitas laporan lama
    if (compScore > 75) componentsConverted[c] = 4;
    else if (compScore > 50) componentsConverted[c] = 3;
    else if (compScore > 25) componentsConverted[c] = 2;
    else if (compScore > 0) componentsConverted[c] = 1;
    else componentsConverted[c] = 0;
  }

  const final = totalW
    ? (components.K1 * (w.K1 || 0) + components.K2 * (w.K2 || 0) + components.K3 * (w.K3 || 0) + components.K4 * (w.K4 || 0)) / totalW
    : 0;
  const finalRounded = Math.round(final * 100) / 100;

  return {
    components,
    componentsConverted,
    final: finalRounded,
    predicate: preds.find(x => finalRounded >= x.min)?.label || 'Kurang',
  };
}

// Section L: Prioritas PKB
export function computePriorities(
  items: Assessment[],
  master: Indicator[],
  bobot?: BobotKomponen,
) {
  const w = bobot || BOBOT_DEFAULT;
  const scored = items
    .filter(a => !a.na && a.score !== undefined)
    .map(a => {
      const ind = master.find(i => i.id === a.indicatorId);
      if (!ind) return null;
      const aspekTotal = ind.aspek.length || 1;
      const aspekTerpenuhi = (a.aspekChecklist || []).filter(Boolean).length;
      const persenAspek = Math.round((aspekTerpenuhi / aspekTotal) * 100);
      return {
        indicatorId: a.indicatorId,
        code: ind.code,
        component: ind.component,
        score: a.score!,
        aspekBelumTerpenuhi: aspekTotal - aspekTerpenuhi,
        persenAspek,
        rekomendasiPKB: ind.rekomendasiPKB || ind.pkb,
        bobotKomponen: w[ind.component] || 0,
        priority: a.score === 0 ? 'Sangat Tinggi' : a.score === 1 ? 'Tinggi' : 'Penguatan/Pemeliharaan',
        rtlStatus: a.rtlStatus || '',
        targetWaktu: a.rtlTarget || '',
      };
    })
    .filter(Boolean) as {
      indicatorId: string; code: string; component: string; score: number;
      aspekBelumTerpenuhi: number; persenAspek: number; rekomendasiPKB: string;
      bobotKomponen: number; priority: string; rtlStatus: string; targetWaktu: string;
    }[];

  return scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.bobotKomponen !== b.bobotKomponen) return b.bobotKomponen - a.bobotKomponen;
    if (a.persenAspek !== b.persenAspek) return a.persenAspek - b.persenAspek;
    return a.code.localeCompare(b.code);
  });
}

// Section S: Validasi Final
export function validateFinalization(items: Assessment[], master: Indicator[]): string[] {
  const errors: string[] = [];
  for (const ind of master.filter(i => i.active)) {
    const a = items.find(x => x.indicatorId === ind.id);
    if (!a) { if (ind.required) errors.push(`${ind.code}: belum dinilai`); continue; }
    if (a.na) {
      if (!(a.naReason || '').trim()) errors.push(`${ind.code}: status N/A wajib disertai alasan`);
      continue;
    }
    if (a.score === undefined) { if (ind.required) errors.push(`${ind.code}: belum diberi skor`); continue; }
    if ((a.score === 0 || a.score === 1) && !a.notes.trim()) errors.push(`${ind.code}: skor ${a.score} wajib memiliki catatan`);
    if ((a.score === 0 || a.score === 1) && !a.rtlMasalah.trim() && !a.rtlTindakan.trim()) errors.push(`${ind.code}: skor ${a.score} wajib memiliki RTL`);
  }
  return errors;
}

export const validateNip = (nip: string) => /^\d{18}$/.test(nip);

export function validatePredicates(rows: PredikatRow[]) {
  return rows.length > 0 && rows.at(-1)?.min === 0 &&
    rows.every((x, i) => x.label.trim() && x.min >= 0 && x.min <= 100 && (i === 0 || rows[i - 1].min > x.min)) &&
    new Set(rows.map(x => x.min)).size === rows.length;
}

export async function checksumPackage(data: any) {
  const clean = { ...data }; delete clean.checksum;
  return sha256(JSON.stringify(clean));
}

export async function exportJson(type: 'ASSIGNMENT' | 'RESULT' | 'BACKUP', data: any) {
  const org = await db.org.toCollection().first();
  const payload = { ...data, packageType: type, version: '2.0.0', organizationId: org?.id, exportedAt: new Date().toISOString() };
  const out = { ...payload, checksum: await checksumPackage(payload) };
  download(`${type === 'BACKUP' ? 'PKPM_BACKUP' : `PKPM_${type}`}_${org?.id}_${Date.now()}.json`, JSON.stringify(out, null, 2), 'application/json');
}

export function download(name: string, data: BlobPart, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

export async function fullBackup() {
  const data: Record<string, unknown> = {};
  for (const t of db.tables) data[t.name] = await t.toArray();
  await exportJson('BACKUP', { data });
}

export async function restore(file: File) {
  await fullBackup();
  const obj = JSON.parse(await file.text());
  if (obj.packageType !== 'BACKUP' || await checksumPackage(obj) !== obj.checksum) throw Error('Checksum atau format backup tidak valid');
  const org = await db.org.toCollection().first();
  if (org && obj.organizationId !== org.id) throw Error('Backup berasal dari organisasi lain');
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      if (obj.data[t.name]?.length) await t.bulkAdd(obj.data[t.name]);
    }
  });
  await audit('RESTORE', 'Database', file.name);
}

export async function saveResult(
  supervisorId: string, assessorId: string, items: Assessment[],
  master: Indicator[], finalize = false,
  extra?: { skPenugasan?: string; tanggalSk?: string; mekanismePenilaian?: 'individual' | 'panel' },
) {
  const configured = (await db.settings.get('predicates'))?.value as PredikatRow[] | undefined;
  const bobot = (await db.settings.get('bobotKomponen'))?.value as BobotKomponen | undefined;
  const mekanisme = (await db.settings.get('mekanismePenilaian'))?.value as 'individual' | 'panel' | undefined;
  const calc = calculate(items, master, configured, bobot);
  const priorities = computePriorities(items, master, bobot).map(p => p.indicatorId);

  const result: Result = {
    id: `2026-${supervisorId}`,
    supervisorId, assessorId, periodId: '2026',
    scores: Object.fromEntries(items.filter(a => !a.na && a.score !== undefined).map(x => [x.indicatorId, x.score!])),
    componentScores: calc.components,
    componentScoresConverted: calc.componentsConverted,
    finalScore: calc.final,
    predicate: calc.predicate,
    priorities,
    status: finalize ? 'final' : 'process',
    finalizedAt: finalize ? new Date().toISOString() : undefined,
    skPenugasan: extra?.skPenugasan,
    tanggalSk: extra?.tanggalSk,
    mekanismePenilaian: extra?.mekanismePenilaian || mekanisme || 'individual',
  };
  await db.results.put(result);
  await audit(finalize ? 'FINALISASI' : 'HITUNG_HASIL', result.id, result);
  return result;
}

// Jenjang filter helper
/**
 * Instrumen yang dipakai penilaian periode berjalan.
 *
 * Diambil dari: butir versi pkpm-0-2-v2 (versi utama saat ini) bila tersedia,
 * jika tidak ada (data lama/legacy atau hasil impor paket) semua instrumen aktif
 * dipakai supaya daftar indikator tidak pernah kosong.
 */
export function instrumenAktif(master: Indicator[]): Indicator[] {
  const v2 = master.filter(i => i.versiInstrumen === 'pkpm-0-2-v2');
  const dasar = v2.length ? v2 : master.filter(i => i.versiInstrumen === 'legacy-1-4');
  const dipakai = dasar.length ? dasar : master;
  return dipakai.filter(i => i.active !== false);
}

/**
 * Filter instrumen sesuai jenjang jabatan pengawas.
 *
 * Toleran terhadap data lama/suntingan admin yang belum mengisi `jenjangBerlaku`:
 * selama instrumennya aktif, butir tersebut tetap ditampilkan untuk semua jenjang.
 * Sebelumnya butir tanpa jenjang ikut tersaring habis sehingga daftar komponen
 * bisa kosong dan nilai akhir tampil 0,00.
 */
export function indicatorsForJenjang(master: Indicator[], jenjang: string): Indicator[] {
  return master.filter(i => {
    if (i.active === false) return false;
    const j = (i.jenjangBerlaku || i.levels || []) as string[];
    if (!j.length) return true; // jenjang belum diisi → anggap berlaku untuk semua
    return j.includes(jenjang);
  });
}
