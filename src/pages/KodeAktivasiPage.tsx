import { useEffect, useState, useCallback } from 'react';
import {
  adminGenerateCode,
  adminBatchCreateCodes,
  adminRegisterCode,
  adminListCodes,
  adminRevokeCode,
  adminReactivateCode,
  adminDeleteCode,
  adminGetStats,
  verifyAdminKey,
  pesanAlasan,
  type KodeLisensi,
} from '../services/pusatLisensi';
import { KeyRound, Plus, Trash2, Copy, Ban, RotateCcw, RefreshCw, Download, Check } from 'lucide-react';

const KEY_STORE = 'pkpm_pusat_admin_key';

/** Label pemilik kode untuk tampilan admin. */
function labelPemilik(k: KodeLisensi): string {
  if (k.used_by) return k.used_by;
  if (k.recipient) return k.recipient;
  return '—';
}

function tanggal(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function KodeAktivasiPage() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(KEY_STORE) || '');
  const [keyOk, setKeyOk] = useState(false);
  const [kode, setKode] = useState<KodeLisensi[]>([]);
  const [stat, setStat] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Form generate
  const [jumlah, setJumlah] = useState(1);
  const [pemilik, setPemilik] = useState('');
  const [kodeManual, setKodeManual] = useState('');
  const [tab, setTab] = useState<'auto' | 'manual'>('auto');

  const [salin, setSalin] = useState('');

  const muat = useCallback(async (key: string) => {
    setBusy(true);
    setErr('');
    const [list, s] = await Promise.all([adminListCodes(key), adminGetStats(key)]);
    setKode(list);
    setStat(s);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!adminKey) return;
    let batal = false;
    (async () => {
      const ok = await verifyAdminKey(adminKey);
      if (batal) return;
      setKeyOk(ok);
      if (ok) await muat(adminKey);
      else setErr('Admin Key tidak diterima server.');
    })();
    return () => { batal = true; };
  }, [adminKey, muat]);

  function simpanKey(v: string) {
    setAdminKey(v);
    if (v) localStorage.setItem(KEY_STORE, v);
    else localStorage.removeItem(KEY_STORE);
    setMsg('');
    setErr('');
  }

  async function buat() {
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = tab === 'auto'
        ? (jumlah > 1
            ? await adminBatchCreateCodes(adminKey, jumlah, pemilik)
            : await adminGenerateCode(adminKey, pemilik))
        : await adminRegisterCode(adminKey, kodeManual, 'pro', pemilik);

      if (!r || !r.success) { setErr(pesanAlasan(r?.reason || 'error')); return; }
      setMsg(`Berhasil menerbitkan ${tab === 'auto' && jumlah > 1 ? jumlah : 1} kode.`);
      setKodeManual(''); setPemilik('');
      await muat(adminKey);
    } finally { setBusy(false); }
  }

  async function aksi(fn: (k: string, c: string) => Promise<any>, kodeStr: string, label: string) {
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await fn(adminKey, kodeStr);
      if (!r || !r.success) { setErr(pesanAlasan(r?.reason || 'error')); return; }
      setMsg(`${label} berhasil.`);
      await muat(adminKey);
    } finally { setBusy(false); }
  }

  function salinKode(t: string) {
    navigator.clipboard?.writeText(t);
    setSalin(t);
    setTimeout(() => setSalin(''), 1500);
  }

  function eksporCsV() {
    const head = 'kode,pemilik,status,dipakai_oleh,dibuat';
    const rows = kode.map(k =>
      [k.code, k.recipient || '', k.is_active ? 'aktif' : 'nonaktif', k.used_by || '', tanggal(k.created_at)].join(','),
    );
    const blob = new Blob([[head, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kode-epkpm-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  if (!keyOk) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="text-[#173f70]" size={22} />
            <h2 className="text-xl font-bold text-[#173f70]">Admin Key Pusat Lisensi</h2>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Masukkan Admin Key Pusat Lisensi untuk mengelola kode aktivasi e-PKPM.
            Key disimpan di perangkat ini saja dan tidak ikut terkirim ke mana pun selain server lisensi.
          </p>
          <input
            type="password"
            className="input mb-3"
            placeholder="Admin Key"
            defaultValue={adminKey}
            onBlur={e => simpanKey(e.target.value.trim())}
            onKeyDown={e => { if (e.key === 'Enter') simpanKey((e.target as HTMLInputElement).value.trim()); }}
          />
          {err && <p className="text-red-600 text-sm mb-3">{err}</p>}
          <button
            className="btn-primary w-full"
            disabled={busy}
            onClick={() => {
              const el = document.querySelector<HTMLInputElement>('input[type=password]');
              simpanKey((el?.value || '').trim());
            }}
          >
            {busy ? 'Memeriksa…' : 'Masuk Panel Kode'}
          </button>
        </div>
      </div>
    );
  }

  const aktif = kode.filter(k => k.is_active).length;
  const terpakai = kode.filter(k => k.used_by).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#173f70]">Kode Aktivasi</h1>
          <p className="text-sm text-slate-500">Model satu kode = satu akun. Kode tersimpan di Pusat Lisensi.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => muat(adminKey)} disabled={busy}>
            <RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Muat ulang
          </button>
          <button className="btn-ghost" onClick={eksporCsV} disabled={!kode.length}>
            <Download size={16} /> Ekspor CSV
          </button>
          <button className="btn-ghost text-red-600" onClick={() => simpanKey('')}>
            Keluar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Total kode', kode.length],
          ['Kode aktif', aktif],
          ['Sudah dipakai', terpakai],
          ['Masih tersedia', aktif - terpakai],
        ].map(([label, nilai]) => (
          <div key={String(label)} className="card p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-[#173f70]">{nilai}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="font-bold text-[#173f70] mb-4">Terbitkan Kode Baru</h3>
        <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
          <button
            className={`px-4 py-1.5 rounded-md text-sm font-bold ${tab === 'auto' ? 'bg-white text-[#173f70] shadow' : 'text-slate-500'}`}
            onClick={() => setTab('auto')}
          >
            Otomatis
          </button>
          <button
            className={`px-4 py-1.5 rounded-md text-sm font-bold ${tab === 'manual' ? 'bg-white text-[#173f70] shadow' : 'text-slate-500'}`}
            onClick={() => setTab('manual')}
          >
            Kode Sendiri
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {tab === 'auto' ? (
            <div>
              <label>Jumlah kode</label>
              <input
                type="number" min={1} max={50}
                className="input"
                value={jumlah}
                onChange={e => setJumlah(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              />
            </div>
          ) : (
            <div>
              <label>Kode</label>
              <input
                className="input uppercase"
                placeholder="EPKPM-BUDI-2026"
                value={kodeManual}
                onChange={e => setKodeManual(e.target.value)}
              />
            </div>
          )}
          <div>
            <label>Keterangan pemilik (opsional)</label>
            <input
              className="input"
              placeholder="Nama / NIP pengawas"
              value={pemilik}
              onChange={e => setPemilik(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" onClick={buat} disabled={busy}>
              <Plus size={16} /> {busy ? 'Memproses…' : 'Terbitkan'}
            </button>
          </div>
        </div>

        {msg && <p className="text-emerald-700 text-sm mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{msg}</p>}
        {err && <p className="text-red-600 text-sm mt-4 bg-red-50 border border-red-200 rounded-lg p-3">{err}</p>}
      </div>

      <div className="card p-5">
        <h3 className="font-bold text-[#173f70] mb-4">Daftar Kode</h3>
        {!kode.length ? (
          <p className="text-sm text-slate-500">Belum ada kode untuk aplikasi ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="py-2">Kode</th>
                  <th className="py-2">Pemilik</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Dipakai oleh</th>
                  <th className="py-2">Dibuat</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {kode.map(k => {
                  const selesai = !!k.used_by;
                  return (
                    <tr key={k.code + (k.id || '')} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">
                        <button className="inline-flex items-center gap-1 hover:text-[#173f70]" onClick={() => salinKode(k.code)}>
                          {k.code}
                          {salin === k.code ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} className="text-slate-400" />}
                        </button>
                      </td>
                      <td className="py-2 text-slate-600">{labelPemilik(k)}</td>
                      <td className="py-2">
                        <span className={`badge ${k.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                          {k.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-2">{selesai ? <span className="text-emerald-700">Sudah</span> : <span className="text-slate-400">Belum</span>}</td>
                      <td className="py-2 text-slate-500">{tanggal(k.created_at)}</td>
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          {k.is_active ? (
                            <button
                              title="Nonaktifkan"
                              className="p-1.5 rounded hover:bg-amber-50 text-amber-600"
                              disabled={busy}
                              onClick={() => aksi(adminRevokeCode, k.code, 'Nonaktifkan kode')}
                            >
                              <Ban size={15} />
                            </button>
                          ) : (
                            <button
                              title="Aktifkan kembali"
                              className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600"
                              disabled={busy}
                              onClick={() => aksi(adminReactivateCode, k.code, 'Aktifkan kode')}
                            >
                              <RotateCcw size={15} />
                            </button>
                          )}
                          <button
                            title="Hapus kode"
                            className="p-1.5 rounded hover:bg-red-50 text-red-600"
                            disabled={busy}
                            onClick={() => {
                              if (confirm(`Hapus kode ${k.code}? Akses akun yang memakainya akan dicabut permanen.`)) {
                                aksi(adminDeleteCode, k.code, 'Hapus kode');
                              }
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
