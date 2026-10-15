/**
 * Halaman Penggabungan Data (Merge) — Opsi A.
 *
 * Alur: pilih file backup perangkat lain -> pratinjau (apa yang akan
 * ditambahkan/diperbarui, mana yang bentrok) -> putuskan konflik -> jalankan.
 * Tidak ada data lokal yang dihapus.
 */
import { useState } from 'react';
import { Button, Card, PageTitle } from '../components/Layout';
import { planMerge, runMerge, type ConflictItem, type MergePreview, type MergeResult } from '../services/merge';
import { AlertTriangle, CheckCircle2, FileUp, GitMerge, Plus, RefreshCw } from 'lucide-react';

type Resolution = 'new' | 'local';

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
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [payload, setPayload] = useState<any>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolution, setResolution] = useState<Record<string, Resolution>>({});
  const [defaultResolution, setDefaultResolution] = useState<'new' | 'local'>('new');
  const [result, setResult] = useState<MergeResult | null>(null);

  async function pilihFile(f: File) {
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const { preview: p, payload: pl } = await planMerge(f);
      setPreview(p);
      setPayload(pl);
      setFileName(f.name);
      setResolution({});
    } catch (x: any) {
      setError(x.message || 'Gagal membaca file backup');
      setPreview(null);
      setPayload(null);
    } finally {
      setBusy(false);
    }
  }

  async function jalankan() {
    if (!payload) return;
    setBusy(true);
    setError('');
    try {
      const r = await runMerge(payload, { defaultResolution, resolutions: resolution });
      setResult(r);
      setPreview(null);
      setPayload(null);
      setFileName('');
    } catch (x: any) {
      setError(x.message || 'Penggabungan gagal');
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
      />

      <Card>
        <div className="flex items-start gap-3">
          <FileUp className="text-[#173f70] mt-0.5" size={20} />
          <div className="flex-1">
            <b>Pilih file backup perangkat lain</b>
            <p className="text-sm text-slate-500 mt-1">
              Gunakan file hasil <b>Backup Seluruh Data</b> dari perangkat lain
              (<code className="text-xs bg-slate-100 px-1 rounded">PKPM_BACKUP_*.json</code>).
              Data di perangkat ini <b>tidak akan dihapus</b>.
            </p>
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              className="mt-3 block text-sm"
              onChange={e => e.target.files?.[0] && pilihFile(e.target.files[0])}
            />
            {fileName && <p className="text-xs text-slate-500 mt-2">File: {fileName}</p>}
          </div>
        </div>
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
              {busy ? 'Menggabungkan…' : `Gabungkan Sekarang${preview.conflicts.length ? ` (${preview.conflicts.length} konflik)` : ''}`}
            </Button>
            <Button variant="light" disabled={busy} onClick={() => { setPreview(null); setPayload(null); setFileName(''); }}>
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
          <div className="mt-4 flex gap-2">
            <Button variant="light" onClick={() => location.reload()}>Muat ulang aplikasi</Button>
          </div>
        </Card>
      )}
    </>
  );
}
