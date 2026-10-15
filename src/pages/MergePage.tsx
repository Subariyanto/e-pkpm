/**
 * Halaman Penggabungan Data (Merge) — Opsi A.
 *
 * Alur: pilih satu atau beberapa file backup perangkat lain -> pratinjau
 * (apa yang akan ditambahkan/diperbarui, mana yang bentrok) -> putuskan
 * konflik -> jalankan. Tidak ada data lokal yang dihapus.
 *
 * Beberapa file boleh dimasukkan sekaligus (mis. hasil kerja seluruh tim
 * penilai). Pratinjau dihitung dari gabungan semua file, tetapi penggabungan
 * tetap dijalankan per file agar keputusan konflik tetap terpisah dan jelas.
 */
import { useState } from 'react';
import { Button, Card, PageTitle } from '../components/Layout';
import {
  planMergePayload,
  runMerge,
  type ConflictItem,
  type MergePreview,
  type MergeResult,
} from '../services/merge';
import { fullBackup } from '../services/core';
import { AlertTriangle, CheckCircle2, Download, FileUp, GitMerge, Plus, RefreshCw, Trash2 } from 'lucide-react';

type Resolution = 'new' | 'local';

interface FileBackup {
  name: string;
  payload: any;
}

const TABLE_LABEL: Record<string, string> = {
  org: 'Organisasi',
  users: 'Akun/Penilai',
  supervisors: 'Pengawas',
  indicators: 'Instrumen',
  assessments: 'Penilaian',
  results: 'Hasil',
  periods: 'Periode',
  audits: 'Audit Log',
  snapshots: 'Snapshot',
  regulations: 'Regulasi',
  regulasi: 'Regulasi',
  imports: 'Impor',
  activationCodes: 'Kode Aktivasi',
};

function nama(t: string) {
  return TABLE_LABEL[t] || t;
}

/**
 * Menyatukan beberapa payload backup menjadi satu payload untuk keperluan
 * pratinjau. Record yang sama (jenis data + id) hanya dihitung sekali.
 */
function gabungPayload(files: FileBackup[]) {
  const data: Record<string, any[]> = {};
  const seen = new Set<string>();
  let organizationId: string | undefined;
  for (const f of files) {
    organizationId = organizationId || f.payload?.organizationId;
    const bagian = f.payload?.data || {};
    for (const [t, rows] of Object.entries(bagian)) {
      if (!Array.isArray(rows)) continue;
      const list = (data[t] = data[t] || []);
      for (const r of rows as any[]) {
        const k = `${t}::${r?.id ?? JSON.stringify(r)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        list.push(r);
      }
    }
  }
  return { packageType: 'BACKUP', version: '2.0.0', organizationId, data };
}

/** Menjumlahkan hasil penggabungan beberapa file menjadi satu ringkasan. */
function jumlahkan(hasil: MergeResult[]): MergeResult {
  const total: MergeResult = { added: 0, updated: 0, keptLocal: 0, skipped: 0, perTable: {} };
  for (const r of hasil) {
    total.added += r.added;
    total.updated += r.updated;
    total.keptLocal += r.keptLocal;
    total.skipped += r.skipped;
    for (const [t, v] of Object.entries(r.perTable)) {
      total.perTable[t] = total.perTable[t] || { added: 0, updated: 0 };
      total.perTable[t].added += v.added;
      total.perTable[t].updated += v.updated;
    }
  }
  return total;
}

/** Rangkum nilai kunci sebuah record penilaian untuk perbandingan. */
function ringkas(r: any): { kunci: string; nilai: string }[] {
  if (!r || typeof r !== 'object') return [];
  const out: { kunci: string; nilai: string }[] = [];
  const push = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === '') return;
    out.push({ kunci: k, nilai: String(v) });
  };
  push('Skor', r.score);
  push('Status dokumen', r.documentStatus);
  push('Nilai akhir', r.finalScore);
  push('Predikat', r.predicate);
  push('Status', r.status);
  push('Catatan', r.notes);
  push('Temuan', r.finding);
  push('Nama', r.name);
  push('NIP', r.nip);
  push('Kode', r.code);
  push('Judul', r.title || r.description);
  push('Diperbarui', r.updatedAt);
  return out;
}

export function MergePage() {
  const [files, setFiles] = useState<FileBackup[]>([]);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [error, setError] = useState('');
  const [catatan, setCatatan] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [resolution, setResolution] = useState<Record<string, Resolution>>({});
  const [defaultResolution, setDefaultResolution] = useState<'new' | 'local'>('new');
  const [result, setResult] = useState<MergeResult | null>(null);
  const [perFile, setPerFile] = useState<{ name: string; hasil: MergeResult }[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupInfo, setBackupInfo] = useState('');

  /** Simpan seluruh data perangkat ini ke satu file, untuk disetor ke Ketua Pokjawas. */
  async function simpanHasilGabungan() {
    setBackupBusy(true);
    setBackupInfo('');
    try {
      await fullBackup();
      setBackupInfo('File backup dibuat. Kirim file PKPM_BACKUP_*.json tersebut ke Ketua Pokjawas.');
    } catch (x: any) {
      setBackupInfo(x?.message || 'Gagal membuat file backup.');
    } finally {
      setBackupBusy(false);
    }
  }

  /** Membaca file yang dipilih pengguna (boleh beberapa sekaligus). */
  async function pilihFile(daftar: FileList) {
    setError('');
    setResult(null);
    setPerFile([]);
    setPreview(null);
    setResolution({});
    setBusy(true);
    const masuk: FileBackup[] = [];
    const gagal: string[] = [];
    for (const f of Array.from(daftar)) {
      try {
        const obj = JSON.parse(await f.text());
        if (obj?.packageType !== 'BACKUP') {
          gagal.push(`${f.name}: bukan file backup lengkap`);
          continue;
        }
        if (files.some(x => x.name === f.name)) {
          gagal.push(`${f.name}: sudah ada di daftar`);
          continue;
        }
        masuk.push({ name: f.name, payload: obj });
      } catch {
        gagal.push(`${f.name}: tidak dapat dibaca (JSON rusak)`);
      }
    }
    const baru = [...files, ...masuk];
    setFiles(baru);
    setCatatan(gagal);
    setBusy(false);
    if (!baru.length) return;
    await analisa(baru);
  }

  /** Menghitung pratinjau dari gabungan semua file yang ada di daftar. */
  async function analisa(daftar: FileBackup[] = files) {
    if (!daftar.length) return;
    setBusy(true);
    setError('');
    setPreview(null);
    setResolution({});
    try {
      const { preview: p } = await planMergePayload(gabungPayload(daftar));
      setPreview(p);
    } catch (x: any) {
      setError(x.message || 'Gagal membaca file backup');
    } finally {
      setBusy(false);
    }
  }

  async function hapusFile(nama: string) {
    const sisa = files.filter(f => f.name !== nama);
    setFiles(sisa);
    setResult(null);
    setPerFile([]);
    if (!sisa.length) {
      setPreview(null);
      return;
    }
    await analisa(sisa);
  }

  async function jalankan() {
    if (!files.length) return;
    setBusy(true);
    setError('');
    const hasil: { name: string; hasil: MergeResult }[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        // Cadangan pengaman cukup sekali, di file pertama.
        const r = await runMerge(files[i].payload, {
          defaultResolution,
          resolutions: resolution,
          safetyBackup: i === 0,
        });
        hasil.push({ name: files[i].name, hasil: r });
      }
      setPerFile(hasil);
      setResult(jumlahkan(hasil.map(h => h.hasil)));
      setPreview(null);
      setFiles([]);
      setResolution({});
    } catch (x: any) {
      setError(x.message || 'Penggabungan gagal');
      setPerFile(hasil);
      if (hasil.length) setResult(jumlahkan(hasil.map(h => h.hasil)));
    } finally {
      setBusy(false);
    }
  }

  const setRes = (c: ConflictItem, v: Resolution) =>
    setResolution(prev => ({ ...prev, [`${c.table}::${c.key}`]: v }));

  const addTotal = preview ? Object.values(preview.toAdd).reduce((a, b) => a + b, 0) : 0;
  const updTotal = preview ? Object.values(preview.toUpdate).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <PageTitle
        title="Gabungkan Data Antar Perangkat"
        desc="Satukan hasil kerja dari beberapa perangkat tanpa menghapus data lokal"
        action={
          <Button variant="light" disabled={backupBusy} onClick={simpanHasilGabungan}>
            <Download size={16} className="inline" /> {backupBusy ? 'Menyiapkan…' : 'Backup Hasil Gabungan'}
          </Button>
        }
      />

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5">
        <GitMerge size={16} className="text-[#173f70] mt-0.5 shrink-0" />
        <p className="text-xs text-slate-700">
          Halaman ini boleh dijalankan siapa saja yang sudah masuk, tidak harus akun admin — Ketua Pokjawas
          dapat meminta bantuan tim penilai untuk menggabungkan. Bisa memasukkan <b>beberapa file sekaligus</b>{' '}
          (pilih semua file backup lalu klik Buka). Setelah selesai, klik <b>Backup Hasil Gabungan</b> lalu kirim
          file <code className="bg-white px-1 rounded">PKPM_BACKUP_*.json</code> ke Ketua Pokjawas, karena hasil
          gabungan tersimpan di perangkat yang menjalankan.
        </p>
      </div>

      {backupInfo && <p className="text-sm text-[#173f70] bg-slate-100 rounded-lg p-3 mb-5">{backupInfo}</p>}

      <Card>
        <div className="flex items-start gap-3">
          <FileUp className="text-[#173f70] mt-0.5" size={20} />
          <div className="flex-1">
            <b>Pilih file backup perangkat lain</b>
            <p className="text-sm text-slate-500 mt-1">
              Gunakan file hasil <b>Backup Seluruh Data</b> dari perangkat lain
              (<code className="text-xs bg-slate-100 px-1 rounded">PKPM_BACKUP_*.json</code>). Boleh memilih
              beberapa file sekaligus dengan menekan Ctrl/Cmd saat memilih. Data di perangkat ini{' '}
              <b>tidak akan dihapus</b>.
            </p>
            <input
              type="file"
              accept=".json,application/json"
              multiple
              disabled={busy}
              className="mt-3 block text-sm"
              onChange={e => {
                if (e.target.files?.length) pilihFile(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {catatan.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-bold text-amber-800 mb-1">File yang dilewati</p>
            <ul className="text-xs text-amber-800 list-disc list-inside space-y-0.5">
              {catatan.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">
              File yang akan digabung ({files.length})
            </p>
            <div className="divide-y border rounded-lg">
              {files.map(f => (
                <div key={f.name} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm truncate">{f.name}</span>
                  <Button variant="danger" disabled={busy} onClick={() => hapusFile(f.name)}>
                    <Trash2 size={14} className="inline" /> Buang
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="text-red-600 mt-0.5 shrink-0" size={18} />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </Card>

      {preview && (
        <>
          <Card className="mt-5">
            <div className="flex items-center gap-2 mb-4">
              <GitMerge className="text-[#173f70]" size={20} />
              <b className="text-[#173f70]">Pratinjau Penggabungan</b>
              <span className="text-xs text-slate-500">— dihitung dari {files.length} file</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-slate-600">Data baru</p>
                <b className="text-2xl text-[#173f70]">{addTotal}</b>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="text-xs text-slate-600">Akan diperbarui</p>
                <b className="text-2xl text-amber-700">{updTotal}</b>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs text-slate-600">Perlu keputusan</p>
                <b className="text-2xl text-red-700">{preview.conflicts.length}</b>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-600">Sudah sama</p>
                <b className="text-2xl text-slate-700">{preview.identical}</b>
              </div>
            </div>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Rincian per jenis data</p>
                <div className="divide-y border rounded-lg">
                  {Object.entries(preview.toAdd).map(([t, n]) => (
                    <div key={`a-${t}`} className="flex justify-between px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <Plus size={14} className="text-blue-600" /> {nama(t)}
                      </span>
                      <b className="text-blue-700">+{n}</b>
                    </div>
                  ))}
                  {Object.entries(preview.toUpdate).map(([t, n]) => (
                    <div key={`u-${t}`} className="flex justify-between px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <RefreshCw size={14} className="text-amber-600" /> {nama(t)}
                      </span>
                      <b className="text-amber-700">↻{n}</b>
                    </div>
                  ))}
                  {!Object.keys(preview.toAdd).length && !Object.keys(preview.toUpdate).length && (
                    <div className="px-3 py-3 text-sm text-slate-500">Tidak ada data baru untuk digabung.</div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Aturan bila tidak ada keputusan</p>
                <div className="border rounded-lg p-3 space-y-2">
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={defaultResolution === 'new'}
                      onChange={() => setDefaultResolution('new')}
                      className="mt-1"
                    />
                    <span>
                      <b>Pakai data dari file</b>
                      <span className="block text-xs text-slate-500">Data perangkat lain dianggap lebih baru.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={defaultResolution === 'local'}
                      onChange={() => setDefaultResolution('local')}
                      className="mt-1"
                    />
                    <span>
                      <b>Pertahankan data perangkat ini</b>
                      <span className="block text-xs text-slate-500">Aman bila bapak ragu pada isi file.</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </Card>

          {preview.conflicts.length > 0 && (
            <Card className="mt-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="text-red-600" size={20} />
                <b className="text-[#173f70]">Perlu Keputusan Manual ({preview.conflicts.length})</b>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Record berikut isinya berbeda antara perangkat ini dan file backup.
                Pilih versi yang benar untuk masing-masing.
              </p>
              <div className="space-y-3">
                {preview.conflicts.map((c, i) => {
                  const kunci = `${c.table}::${c.key}`;
                  const pilihan = resolution[kunci] || defaultResolution;
                  return (
                    <div key={kunci + i} className="border rounded-lg overflow-hidden">
                      <div className="bg-slate-100 px-3 py-2 flex justify-between items-center">
                        <b className="text-sm text-[#173f70]">{c.label}</b>
                        <span className="text-xs text-slate-500">{nama(c.table)}</span>
                      </div>
                      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                        <label className={`p-3 cursor-pointer ${pilihan === 'local' ? 'bg-emerald-50' : ''}`}>
                          <span className="flex items-center gap-2 mb-2">
                            <input type="radio" checked={pilihan === 'local'} onChange={() => setRes(c, 'local')} />
                            <b className="text-sm">Perangkat ini</b>
                          </span>
                          <dl className="text-xs space-y-1">
                            {ringkas(c.local).map(x => (
                              <div key={x.kunci} className="flex gap-2">
                                <dt className="text-slate-500 w-28 shrink-0">{x.kunci}</dt>
                                <dd className="text-slate-800 break-words">{x.nilai}</dd>
                              </div>
                            ))}
                          </dl>
                        </label>
                        <label className={`p-3 cursor-pointer ${pilihan === 'new' ? 'bg-emerald-50' : ''}`}>
                          <span className="flex items-center gap-2 mb-2">
                            <input type="radio" checked={pilihan === 'new'} onChange={() => setRes(c, 'new')} />
                            <b className="text-sm">Dari file backup</b>
                          </span>
                          <dl className="text-xs space-y-1">
                            {ringkas(c.incoming).map(x => (
                              <div key={x.kunci} className="flex gap-2">
                                <dt className="text-slate-500 w-28 shrink-0">{x.kunci}</dt>
                                <dd className="text-slate-800 break-words">{x.nilai}</dd>
                              </div>
                            ))}
                          </dl>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <div className="flex flex-wrap gap-3 mt-5">
            <Button disabled={busy} onClick={jalankan}>
              {busy
                ? 'Menggabungkan…'
                : `Gabungkan ${files.length} File Sekarang${preview.conflicts.length ? ` (${preview.conflicts.length} konflik)` : ''}`}
            </Button>
            <Button
              variant="light"
              disabled={busy}
              onClick={() => { setPreview(null); setFiles([]); setResolution({}); setCatatan([]); }}
            >
              Batal
            </Button>
            <p className="text-xs text-slate-500 self-center">
              Backup otomatis dibuat sebelum penggabungan dijalankan.
            </p>
          </div>
        </>
      )}

      {result && (
        <Card className="mt-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="text-emerald-600" size={20} />
            <b className="text-[#173f70]">Penggabungan Selesai</b>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-xs text-slate-600">Ditambahkan</p>
              <b className="text-2xl text-emerald-700">{result.added}</b>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-slate-600">Diperbarui</p>
              <b className="text-2xl text-amber-700">{result.updated}</b>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-slate-600">Dipertahankan</p>
              <b className="text-2xl text-[#173f70]">{result.keptLocal}</b>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-600">Sudah sama</p>
              <b className="text-2xl text-slate-700">{result.skipped}</b>
            </div>
          </div>

          {perFile.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Rincian per file</p>
              <div className="divide-y border rounded-lg">
                {perFile.map(f => (
                  <div key={f.name} className="flex justify-between gap-3 px-3 py-2 text-sm">
                    <span className="truncate">{f.name}</span>
                    <span className="text-slate-600 whitespace-nowrap">
                      <b className="text-blue-700">+{f.hasil.added}</b> ·{' '}
                      <b className="text-amber-700">↻{f.hasil.updated}</b>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <details className="mt-4">
            <summary className="text-sm cursor-pointer text-[#173f70] font-bold">Rincian per jenis data</summary>
            <div className="divide-y border rounded-lg mt-2">
              {Object.entries(result.perTable)
                .filter(([, v]) => v.added || v.updated)
                .map(([t, v]) => (
                  <div key={t} className="flex justify-between px-3 py-2 text-sm">
                    <span>{nama(t)}</span>
                    <span className="text-slate-600">
                      <b className="text-blue-700">+{v.added}</b> · <b className="text-amber-700">↻{v.updated}</b>
                    </span>
                  </div>
                ))}
            </div>
          </details>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={backupBusy} onClick={simpanHasilGabungan}>
              <Download size={16} className="inline" /> {backupBusy ? 'Menyiapkan…' : 'Backup Hasil Gabungan'}
            </Button>
            <Button variant="light" onClick={() => location.reload()}>Muat ulang aplikasi</Button>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Kirim file <b>PKPM_BACKUP_*.json</b> hasil tombol di atas ke Ketua Pokjawas agar semua hasil
            penilaian terkumpul di satu perangkat.
          </p>
        </Card>
      )}
    </>
  );
}
