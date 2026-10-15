import { useEffect, useState } from 'react';
import { activationState } from '../services/activation';
import { seedDemo } from '../services/core';
import { registerAccount, loginAccount, pusatOnline, pesanAlasan } from '../services/pusatLisensi';
import { db } from '../lib/db';
import { sha256 } from '../services/core';
import { KeyRound, ShieldCheck, UserPlus, LogIn } from 'lucide-react';

type Mode = 'aktivasi' | 'login';

/**
 * Layar Aktivasi & Login — model 1 kode aktivasi = 1 akun.
 *
 * Aktivasi: kode + username + password -> akun dibuat di Pusat Lisensi.
 * Login   : username + password -> diverifikasi ke server, bisa dari perangkat
 *           mana pun. Bila offline, dipakai verifikasi lokal sebagai cadangan.
 */
export function Activation({ onReady }: { onReady: () => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [konfirmasi, setKonfirmasi] = useState('');
  const [fullname, setFullname] = useState('');
  const [device, setDevice] = useState(localStorage.getItem('pkpm_device_name') || '');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    activationState().then((s: any) => {
      if (!s) return;
      const expiry = new Date(s.licenseEndDate || 0).getTime();
      if ((s.licenseStatus === 'active' && expiry > Date.now()) || (!navigator.onLine && expiry > Date.now())) {
        onReady();
      } else {
        setError('Lisensi telah berakhir atau akun dinonaktifkan.');
      }
    });
  }, [onReady]);

  /** Setelah akun valid, siapkan sesi lokal. */
  async function mulaiSesi(namaAkun: string, namaLengkap?: string) {
    localStorage.setItem('pkpm_device_name', device || 'Perangkat');
    localStorage.setItem('pkpm_account_code', namaAkun);
    sessionStorage.setItem('userName', namaLengkap || namaAkun);
    onReady();
  }

  async function submitAktivasi(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (password.length < 6) return setError('Password minimal 6 karakter.');
    if (password !== konfirmasi) return setError('Konfirmasi password tidak cocok.');
    if (username.trim().length < 4) return setError('Username minimal 4 karakter.');
    setBusy(true);
    try {
      const r = await registerAccount({
        code: code.trim().toUpperCase(),
        username: username.trim(),
        password,
        fullname,
        deviceInfo: `e-PKPM · ${device || 'Perangkat'}`,
      });
      if (!r.success) return setError(pesanAlasan(r.reason));
      await mulaiSesi(r.username || username.trim(), fullname);
    } catch (x: any) {
      setError(x.message || 'Aktivasi gagal');
    } finally {
      setBusy(false);
    }
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const r = await loginAccount({ username: username.trim(), password });

      if (r.valid) {
        await mulaiSesi(r.username || username.trim(), r.fullname);
        return;
      }

      if (r.reason === 'network_error') {
        // Cadangan offline: cocokkan dengan akun yang pernah dipakai di perangkat ini.
        const lokal = await db.users.where('username').equals(username.trim().toLowerCase()).first();
        if (lokal && lokal.pinHash === (await sha256(password))) {
          setInfo('Mode offline: login diverifikasi dari perangkat ini.');
          await mulaiSesi(lokal.username, lokal.name);
          return;
        }
        setError('Tidak dapat menghubungi server lisensi. Sambungkan internet dan coba lagi.');
        return;
      }

      setError(pesanAlasan(r.reason));
    } catch (x: any) {
      setError(x.message || 'Login gagal');
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    await seedDemo();
    localStorage.setItem('pkpm_demo_activation', '1');
    onReady();
  }

  return (
    <div className="min-h-screen bg-[#102a4c] grid place-items-center p-4">
      <form
        onSubmit={mode === 'aktivasi' ? submitAktivasi : submitLogin}
        className="bg-white w-full max-w-lg p-8 rounded-2xl shadow-2xl"
      >
        <h1 className="text-4xl font-bold text-[#173f70] text-center">e-PKPM</h1>
        <p className="text-center text-slate-500 mb-6">Penilaian Kinerja Pengawas Madrasah</p>

        <div className="grid grid-cols-2 gap-2 mb-6 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); setInfo(''); }}
            className={`py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 ${mode === 'login' ? 'bg-white text-[#173f70] shadow' : 'text-slate-500'}`}
          >
            <LogIn size={16} /> Masuk
          </button>
          <button
            type="button"
            onClick={() => { setMode('aktivasi'); setError(''); setInfo(''); }}
            className={`py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 ${mode === 'aktivasi' ? 'bg-white text-[#173f70] shadow' : 'text-slate-500'}`}
          >
            <UserPlus size={16} /> Aktivasi Kode
          </button>
        </div>

        {mode === 'aktivasi' && (
          <>
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5">
              <KeyRound className="text-[#173f70] mt-0.5 shrink-0" size={18} />
              <p className="text-xs text-slate-700">
                Satu kode aktivasi hanya untuk satu akun. Setelah diaktivasi,
                akun ini dapat dipakai masuk dari perangkat mana pun.
              </p>
            </div>

            <label>Kode aktivasi</label>
            <input
              required
              className="input mb-4 uppercase"
              placeholder="EPKPM-XXXX-XXXX-XXXX"
              value={code}
              onChange={e => setCode(e.target.value)}
            />

            <label>Nama lengkap</label>
            <input
              className="input mb-4"
              placeholder="Drs. Ahmad Hidayat, M.Pd."
              value={fullname}
              onChange={e => setFullname(e.target.value)}
            />
          </>
        )}

        <label>Username</label>
        <input
          required
          autoComplete="username"
          className="input mb-4"
          placeholder="username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />

        <label>Password</label>
        <input
          required
          type="password"
          autoComplete={mode === 'aktivasi' ? 'new-password' : 'current-password'}
          className="input mb-4"
          placeholder="minimal 6 karakter"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        {mode === 'aktivasi' && (
          <>
            <label>Ulangi password</label>
            <input
              required
              type="password"
              autoComplete="new-password"
              className="input mb-4"
              value={konfirmasi}
              onChange={e => setKonfirmasi(e.target.value)}
            />

            <label>Nama perangkat</label>
            <input
              className="input mb-4"
              placeholder="Laptop Penilai 1"
              value={device}
              onChange={e => setDevice(e.target.value)}
            />
          </>
        )}

        {error && (
          <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
        )}
        {info && (
          <p className="text-emerald-700 text-sm mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{info}</p>
        )}

        <button
          disabled={busy}
          className="w-full bg-[#173f70] disabled:opacity-50 text-white py-3 rounded-lg font-bold"
        >
          {busy ? 'Memproses…' : mode === 'aktivasi' ? 'Aktivasi & Buat Akun' : 'Masuk'}
        </button>

        <button
          type="button"
          onClick={demo}
          className="w-full mt-3 border border-[#173f70] text-[#173f70] py-3 rounded-lg font-bold"
        >
          Masuk Mode Demo
        </button>

        <p className="flex items-center justify-center gap-1 text-xs text-slate-500 mt-5 text-center">
          <ShieldCheck size={14} /> Password disimpan sebagai hash; server tidak menerima password asli.
        </p>
      </form>
    </div>
  );
}
