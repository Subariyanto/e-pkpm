/**
 * Data Pengawas — master pengawas yang dinilai.
 *
 * Penambahan dan penyuntingan memakai formulir penuh (bukan rangkaian
 * kotak dialog) supaya pengisian data lebih mudah dan tervalidasi.
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, audit } from '../lib/db';
import { Button, Card, PageTitle, IconButton } from '../components/Layout';
import type { Supervisor, User } from '../types';
import { Plus, Pencil, Trash2, Save, X, Search, UserRound } from 'lucide-react';

/** Seluruh kolom pada formulir data pengawas. */
type Form = {
  name: string; nip: string; position: string; level: string; rank: string;
  workUnit: string; region: string; phone: string; email: string;
  assessorId: string; active: boolean;
};

const KOSONG: Form = {
  name: '', nip: '', position: 'Pengawas Madrasah', level: 'Madya', rank: '',
  workUnit: 'Kantor Kementerian Agama Kab. Jember', region: '', phone: '', email: '',
  assessorId: '', active: true,
};

const LEVEL = ['Muda', 'Madya', 'Utama'];

/** Pilihan pangkat/golongan ruang pengawas: golongan III ke atas. */
export const PANGKAT_GOL = [
  'Penata Muda / III a', 'Penata Muda Tk. I / III b', 'Penata / III c', 'Penata Tk. I / III d',
  'Pembina / IV a', 'Pembina Tk. I / IV b', 'Pembina Utama Muda / IV c',
  'Pembina Utama Madya / IV d', 'Pembina Utama / IV e',
  'PPPK Ahli Pertama / IX', 'PPPK Ahli Muda / X', 'PPPK Ahli Madya / XI',
];

export function SupervisorPage() {
  const data = useLiveQuery(() => db.supervisors.toArray(), []) || [];
  const users = useLiveQuery(() => db.users.toArray(), []) || [];
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const penilai = users.filter((u: User) => u.roles.includes('assessor'));

  function tambah() {
    setForm({ ...KOSONG });
    setFormId(null);
    setErr('');
    setInfo('');
  }

  function ubah(x: Supervisor) {
    setForm({
      name: x.name || '', nip: x.nip || '', position: x.position || 'Pengawas Madrasah',
      level: x.level || 'Madya', rank: x.rank || '', workUnit: x.workUnit || '',
      region: x.region || '', phone: x.phone || '', email: x.email || '',
      assessorId: x.assessorId || '', active: x.active !== false,
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
    const nip = form.nip.trim();
    if (!nama) return setErr('Nama pengawas wajib diisi.');
    if (!/^\d{18}$/.test(nip)) return setErr('NIP wajib 18 digit angka.');
    const kembar = await db.supervisors.where('nip').equals(nip).first();
    if (kembar && kembar.id !== formId) return setErr('NIP sudah terdaftar pada pengawas lain.');
    if (form.assessorId) {
      const p = penilai.find(u => u.id === form.assessorId);
      if (p && p.nip === nip) return setErr('Pengawas tidak boleh menilai dirinya sendiri. Pilih penilai lain.');
    }

    const nilai: Omit<Supervisor, 'id'> = {
      name: nama, nip,
      rank: form.rank.trim(),
      position: form.position.trim() || 'Pengawas Madrasah',
      level: form.level,
      workUnit: form.workUnit.trim(),
      region: form.region.trim(),
      schools: 0, principals: 0, teachers: 0,
      phone: form.phone.trim(), email: form.email.trim(),
      assessorId: form.assessorId || undefined,
      active: form.active,
    };

    if (formId) {
      const lama = data.find(x => x.id === formId);
      await db.supervisors.update(formId, nilai);
      await audit('UBAH', 'Pengawas', nama, lama);
      setInfo(`Data ${nama} berhasil diperbarui.`);
    } else {
      await db.supervisors.add({ id: crypto.randomUUID(), ...nilai });
      await audit('TAMBAH', 'Pengawas', nama);
      setInfo(`Pengawas ${nama} berhasil ditambahkan.`);
    }
    tutup();
  }

  async function hapus(x: Supervisor) {
    if (!confirm(`Hapus ${x.name}?`)) return;
    if (await db.results.where('supervisorId').equals(x.id).count())
      return alert('Tidak dapat dihapus: sudah memiliki hasil penilaian.');
    await db.supervisors.delete(x.id);
    await audit('HAPUS', 'Pengawas', undefined, x);
    setInfo(`Pengawas ${x.name} dihapus.`);
  }

  async function hapusSemua() {
    if (!data.length) return alert('Belum ada data pengawas untuk dihapus.');
    const berhasil = await db.results.toArray();
    const dipakai = data.filter(x => berhasil.some(r => r.supervisorId === x.id));
    if (dipakai.length)
      return alert(`Tidak dapat menghapus semua: ${dipakai.length} pengawas sudah memiliki hasil penilaian (${dipakai.map(x => x.name).join(', ')}).`);
    if (!confirm(`Hapus SEMUA ${data.length} data pengawas beserta isian penilaiannya? Tindakan ini tidak dapat dibatalkan.`)) return;
    await db.supervisors.bulkDelete(data.map(x => x.id));
    const idSasaran = new Set(data.map(x => x.id));
    const isian = (await db.assessments.toArray()).filter(a => idSasaran.has(a.supervisorId));
    if (isian.length) await db.assessments.bulkDelete(isian.map(a => a.id));
    await audit('HAPUS_SEMUA', 'Pengawas', `${data.length} pengawas, ${isian.length} isian`);
    setInfo(`Semua data pengawas dihapus (${data.length} pengawas, ${isian.length} isian penilaian).`);
  }

  async function excel() {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data.map(x => ({
      Nama: x.name, NIP: x.nip, Jabatan: x.position, Jenjang: x.level,
      'Pangkat/Golongan': x.rank, 'Unit Kerja': x.workUnit, Wilayah: x.region,
      'No. HP': x.phone, Email: x.email,
      Penilai: users.find(u => u.id === x.assessorId)?.name || '',
      Status: x.active ? 'Aktif' : 'Nonaktif',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pengawas');
    XLSX.writeFile(wb, 'data-pengawas.xlsx');
  }

  const tersaring = data.filter(x => (x.name + x.nip + (x.region || '')).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageTitle
        title="Data Pengawas"
        desc="Master Pengawas yang Dinilai"
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="danger" onClick={hapusSemua} disabled={!data.length}>Hapus Semua</Button>
            <Button size="sm" onClick={tambah}><Plus size={14} className="inline" /> Tambah</Button>
            <Button size="sm" variant="light" onClick={excel} disabled={!data.length}>Ekspor Excel</Button>
          </div>
        }
      />

      {/* ===== Formulir Tambah / Ubah Pengawas ===== */}
      {form && (
        <Card className="mb-5 border-2 border-[#173f70]/25 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserRound size={18} className="text-[#173f70]" />
              <h3 className="font-bold text-[#173f70]">
                {formId ? 'Ubah Data Pengawas' : 'Tambah Pengawas Baru'}
              </h3>
            </div>
            <button onClick={tutup} className="text-slate-400 hover:text-slate-700" title="Tutup formulir">
              <X size={18} />
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <label className="text-sm md:col-span-2">Nama lengkap &amp; gelar <span className="text-red-600">*</span>
              <input className="input mt-1" value={form.name} autoFocus
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Nanang Fahrudin, S.Pd, M.Pd." />
            </label>
            <label className="text-sm">NIP (18 digit) <span className="text-red-600">*</span>
              <input className="input mt-1" value={form.nip} inputMode="numeric" maxLength={18}
                onChange={e => setForm({ ...form, nip: e.target.value.replace(/\D/g, '') })}
                placeholder="197002122005011005" />
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
            <label className="text-sm">Pangkat / Golongan
              <select className="input mt-1" value={form.rank}
                onChange={e => setForm({ ...form, rank: e.target.value })}>
                <option value="">— Pilih pangkat / golongan —</option>
                {PANGKAT_GOL.map(x => <option key={x} value={x}>{x}</option>)}
                {form.rank && !PANGKAT_GOL.includes(form.rank) && <option value={form.rank}>{form.rank} (data lama)</option>}
              </select>
            </label>
            <label className="text-sm md:col-span-2">Unit Kerja
              <input className="input mt-1" value={form.workUnit}
                onChange={e => setForm({ ...form, workUnit: e.target.value })}
                placeholder="Kantor Kementerian Agama Kab. Jember" />
            </label>
            <label className="text-sm">Wilayah Binaan / KKMA
              <input className="input mt-1" value={form.region}
                onChange={e => setForm({ ...form, region: e.target.value })}
                placeholder="Contoh: KKMA 04 Sukowono" />
            </label>
            <label className="text-sm">No. HP
              <input className="input mt-1" value={form.phone} inputMode="tel"
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="08xxxxxxxxxx" />
            </label>
            <label className="text-sm">Email
              <input className="input mt-1" value={form.email} type="email"
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="nama@example.id" />
            </label>
            <label className="text-sm">Penilai
              <select className="input mt-1" value={form.assessorId}
                onChange={e => setForm({ ...form, assessorId: e.target.value })}>
                <option value="">— Belum dibagi —</option>
                {penilai.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label className="text-sm flex items-center gap-2 mt-6">
              <input type="checkbox" checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })} />
              Status aktif (ikut dinilai)
            </label>
          </div>

          {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 mt-3">{err}</p>}

          <div className="flex flex-wrap gap-2 mt-4">
            <Button onClick={simpan}><Save size={15} className="inline" /> {formId ? 'Simpan Perubahan' : 'Simpan Pengawas'}</Button>
            <Button variant="light" onClick={tutup}>Batal</Button>
            <span className="text-xs text-slate-500 self-center ml-1">
              Kolom bertanda <span className="text-red-600">*</span> wajib diisi.
            </span>
          </div>
        </Card>
      )}

      {info && <p className="text-sm text-[#173f70] bg-slate-100 rounded-lg p-3 mb-4">{info}</p>}

      <Card>
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Cari nama, NIP, atau wilayah..." value={q}
            onChange={e => setQ(e.target.value)} className="input pl-9" />
        </div>

        {tersaring.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  {['Nama', 'NIP', 'Jabatan', 'Jenjang', 'Pangkat / Gol', 'Wilayah', 'Penilai', 'Status', 'Aksi'].map(h => (
                    <th key={h} className="p-3 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tersaring.map(x => (
                  <tr key={x.id} className="border-b align-top">
                    <td className="p-3 font-semibold text-[#173f70]">{x.name}</td>
                    <td className="p-3 whitespace-nowrap">{x.nip}</td>
                    <td className="p-3">{x.position || '-'}</td>
                    <td className="p-3">{x.level || '-'}</td>
                    <td className="p-3 whitespace-nowrap">{x.rank || '-'}</td>
                    <td className="p-3">{x.region || '-'}</td>
                    <td className="p-3">{users.find(u => u.id === x.assessorId)?.name || <span className="text-slate-400">Belum dibagi</span>}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${x.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {x.active !== false ? 'Aktif' : 'Nonaktif'}
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
            {data.length ? 'Tidak ada pengawas yang cocok dengan pencarian.' : 'Belum ada data pengawas. Klik "Tambah" untuk menambahkan.'}
          </p>
        )}
      </Card>
    </>
  );
}
