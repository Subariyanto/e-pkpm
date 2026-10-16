/**
 * Tim Penilai Kabupaten — akun penilai (admin menyekaligus penilai).
 *
 * Penambahan dan penyuntingan memakai formulir penuh supaya pengisian
 * lebih mudah, termasuk pangkat/golongan dalam bentuk pilihan.
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, audit } from '../lib/db';
import { Button, Card, PageTitle, IconButton } from '../components/Layout';
import { PANGKAT_GOL } from './SupervisorPage';
import { sha256 } from '../services/core';
import type { User } from '../types';
import { Plus, Pencil, Trash2, Save, X, Search, UserRound } from 'lucide-react';

/** Kolom yang diisi pada formulir penilai. */
type Form = {
  name: string; username: string; nip: string; rank: string;
  position: string; level: string; active: boolean;
};

const KOSONG: Form = {
  name: '', username: '', nip: '', rank: '',
  position: 'Pengawas Madrasah', level: 'Madya', active: true,
};

const LEVEL = ['Muda', 'Madya', 'Utama'];
/** PIN awal akun baru; penilai dapat menggantinya setelah masuk. */
const PIN_AWAL = '123456';

export function AssessorPage() {
  const data = useLiveQuery(() => db.users.toArray(), []) || [];
  const ps = useLiveQuery(() => db.supervisors.toArray(), []) || [];
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  function tambah() {
    setForm({ ...KOSONG });
    setFormId(null);
    setErr('');
    setInfo('');
  }

  function ubah(x: User) {
    setForm({
      name: x.name || '', username: x.username || '', nip: x.nip || '',
      rank: x.rank || '', position: x.position || 'Pengawas Madrasah',
      level: x.level || 'Madya', active: x.active !== false,
    });
    setFormId(x.id);
    setErr('');
    setInfo('');
  }

  function tutup() {
    setForm(null);
    setFormId(null);
    setErr('');
  }

  async function simpan() {
    if (!form) return;
    const nama = form.name.trim();
    const username = form.username.trim().toLowerCase();
    const nip = form.nip.trim();
    if (!nama) return setErr('Nama penilai wajib diisi.');
    if (!/^[a-z0-9._-]{3,}$/.test(username)) return setErr('Username minimal 3 karakter, hanya huruf, angka, titik, garis bawah, atau tanda hubung.');
    const pakai = await db.users.where('username').equals(username).first();
    if (pakai && pakai.id !== formId) return setErr('Username sudah dipakai akun lain.');
    if (!/^\d{18}$/.test(nip)) return setErr('NIP wajib 18 digit angka.');

    const nilai: Partial<User> = {
      name: nama, username, nip,
      rank: form.rank.trim(),
      position: form.position.trim() || 'Pengawas Madrasah',
      level: form.level,
      active: form.active,
    };

    if (formId) {
      const lama = data.find(x => x.id === formId);
      await db.users.update(formId, nilai);
      await audit('UBAH', 'Penilai', nama, lama);
      setInfo(`Data penilai ${nama} berhasil diperbarui.`);
    } else {
      await db.users.add({
        id: crypto.randomUUID(), ...nilai,
        pinHash: await sha256(PIN_AWAL), roles: ['assessor'], failed: 0,
      } as User);
      await audit('TAMBAH', 'Penilai', nama);
      setInfo(`Penilai ${nama} ditambahkan. PIN awal ${PIN_AWAL} — minta yang bersangkutan menggantinya setelah masuk.`);
    }
    tutup();
  }

  async function hapus(x: User) {
    if (ps.some(p => p.assessorId === x.id)) return alert('Penilai masih memiliki sasaran. Pindahkan sasarannya lebih dahulu.');
    if (!confirm(`Hapus akun penilai ${x.name}?`)) return;
    await db.users.delete(x.id);
    await audit('HAPUS', 'Penilai', undefined, x);
    setInfo(`Akun penilai ${x.name} dihapus.`);
  }

  async function excel() {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data.map(x => ({
      Nama: x.name, Username: x.username, NIP: x.nip,
      'Pangkat/Golongan': x.rank || '', Jabatan: x.position || '',
      Jenjang: x.level || '', Peran: x.roles.join(' + '),
      'Jumlah Sasaran': ps.filter(p => p.assessorId === x.id).length,
      Status: x.active ? 'Aktif' : 'Nonaktif',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Penilai');
    XLSX.writeFile(wb, 'data-penilai.xlsx');
  }

  const tersaring = data.filter(x => (x.name + x.username + x.nip).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageTitle
        title="Tim Penilai Kabupaten"
        desc="Ketua Pokjawas berperan sebagai Admin sekaligus Penilai"
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={tambah}><Plus size={14} className="inline" /> Tambah Penilai</Button>
            <Button size="sm" variant="light" onClick={excel} disabled={!data.length}>Ekspor Excel</Button>
          </div>
        }
      />

      {form && (
        <Card className="mb-5 border-2 border-[#173f70]/25 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserRound size={18} className="text-[#173f70]" />
              <h3 className="font-bold text-[#173f70]">{formId ? 'Ubah Data Penilai' : 'Tambah Penilai Baru'}</h3>
            </div>
            <button onClick={tutup} className="text-slate-400 hover:text-slate-700" title="Tutup formulir">
              <X size={18} />
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <label className="text-sm md:col-span-2">Nama lengkap &amp; gelar <span className="text-red-600">*</span>
              <input className="input mt-1" value={form.name} autoFocus
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Subariyanto, S.Pd, M.Pd.I." />
            </label>
            <label className="text-sm">NIP (18 digit) <span className="text-red-600">*</span>
              <input className="input mt-1" value={form.nip} inputMode="numeric" maxLength={18}
                onChange={e => setForm({ ...form, nip: e.target.value.replace(/\D/g, '') })}
                placeholder="197002122005011004" />
            </label>
            <label className="text-sm">Username <span className="text-red-600">*</span>
              <input className="input mt-1" value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })}
                placeholder="subariyanto" />
            </label>
            <label className="text-sm">Pangkat / Golongan
              <select className="input mt-1" value={form.rank}
                onChange={e => setForm({ ...form, rank: e.target.value })}>
                <option value="">— Pilih pangkat / golongan —</option>
                {PANGKAT_GOL.map(x => <option key={x} value={x}>{x}</option>)}
                {form.rank && !PANGKAT_GOL.includes(form.rank) && <option value={form.rank}>{form.rank} (data lama)</option>}
              </select>
            </label>
            <label className="text-sm">Jabatan
              <input className="input mt-1" value={form.position}
                onChange={e => setForm({ ...form, position: e.target.value })}
                placeholder="Pengawas Madrasah" />
            </label>
            <label className="text-sm">Jenjang Jabatan
              <select className="input mt-1" value={form.level}
                onChange={e => setForm({ ...form, level: e.target.value })}>
                {LEVEL.map(x => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="text-sm flex items-center gap-2 mt-6">
              <input type="checkbox" checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })} />
              Status aktif (dapat masuk dan menilai)
            </label>
          </div>

          {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 mt-3">{err}</p>}
          {!formId && (
            <p className="text-xs text-slate-600 bg-blue-50 border border-blue-200 rounded-lg p-2 mt-3">
              PIN awal akun baru: <b>{PIN_AWAL}</b> — sampaikan kepada yang bersangkutan untuk diganti setelah masuk.
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            <Button onClick={simpan}><Save size={15} className="inline" /> {formId ? 'Simpan Perubahan' : 'Simpan Penilai'}</Button>
            <Button variant="light" onClick={tutup}>Batal</Button>
            <span className="text-xs text-slate-500 self-center ml-1">Kolom bertanda <span className="text-red-600">*</span> wajib diisi.</span>
          </div>
        </Card>
      )}

      {info && <p className="text-sm text-[#173f70] bg-slate-100 rounded-lg p-3 mb-4">{info}</p>}

      <Card>
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Cari nama, username, atau NIP..." value={q}
            onChange={e => setQ(e.target.value)} className="input pl-9" />
        </div>

        {tersaring.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  {['Nama', 'Username', 'NIP', 'Pangkat / Gol', 'Jabatan', 'Jenjang', 'Peran', 'Sasaran', 'Status', 'Aksi'].map(h => (
                    <th key={h} className="p-3 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tersaring.map(x => (
                  <tr key={x.id} className="border-b align-top">
                    <td className="p-3 font-semibold text-[#173f70]">{x.name}</td>
                    <td className="p-3">{x.username}</td>
                    <td className="p-3 whitespace-nowrap">{x.nip}</td>
                    <td className="p-3 whitespace-nowrap">{x.rank || '-'}</td>
                    <td className="p-3">{x.position || '-'}</td>
                    <td className="p-3">{x.level || '-'}</td>
                    <td className="p-3">{x.roles.join(' + ')}</td>
                    <td className="p-3">{ps.filter(p => p.assessorId === x.id).length}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${x.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {x.active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <IconButton title="Ubah" onClick={() => ubah(x)}><Pencil size={16} /></IconButton>
                        <IconButton title="Hapus" variant="danger" onClick={() => hapus(x)}><Trash2 size={16} /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center p-12 text-slate-400">
            {data.length ? 'Tidak ada penilai yang cocok dengan pencarian.' : 'Belum ada data penilai.'}
          </p>
        )}
      </Card>
    </>
  );
}
