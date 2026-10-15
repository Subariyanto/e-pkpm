import { useLiveQuery } from 'dexie-react-hooks';
import { db, audit } from '../lib/db';
import { Button, Card, PageTitle } from '../components/Layout';
import { regulasiData } from '../data/demo';
import type { Regulasi } from '../types';
type RegForm = { id: string; nomor?: string; tentang?: string; tahun?: number; status?: string; catatan?: string; link?: string } & Partial<Regulasi>;
import { useState } from 'react';
import { BookOpen, ExternalLink, Plus, Pencil } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  berlaku: 'bg-emerald-100 text-emerald-800',
  diubah: 'bg-amber-100 text-amber-800',
  dicabut: 'bg-red-100 text-red-800',
  pedoman_teknis: 'bg-blue-100 text-blue-800',
  referensi: 'bg-slate-100 text-slate-700',
};

export function RegulasiPage() {
  const data = useLiveQuery(() => db.regulasi.toArray(), []) || [];
  const [form, setForm] = useState<RegForm | null>(null);
  const [search, setSearch] = useState('');

  const filtered = data.filter((r) =>
    !search || (r.nomor||'').toLowerCase().includes(search.toLowerCase()) || (r.tentang||'').toLowerCase().includes(search.toLowerCase()),
  );

  async function seedDefaults() {
    const existing = await db.regulasi.count();
    if (existing) {
      if (!confirm('Regulasi sudah ada. Tambahkan data default (tanpa menghapus yang sudah ada)?')) return;
    }
    const toAdd = existing ? regulasiData.filter(d => !data.some(x => x.id === d.id)) : regulasiData;
    await db.regulasi.bulkAdd(toAdd);
    await audit('SEED', 'Regulasi', toAdd);
  }

  async function save() {
    if (!form) return;
    if (!(form.nomor||'').trim() || !(form.tentang||'').trim()) return alert('Nomor dan tentang wajib diisi');
    const old = await db.regulasi.get(form.id);
    await db.regulasi.put(form as Regulasi);
    await audit(old ? 'UBAH' : 'TAMBAH', 'Regulasi', form, old);
    setForm(null);
  }

  async function del(r: Regulasi) {
    if (confirm(`Hapus regulasi ${r.nomor}?`)) {
      await db.regulasi.delete(r.id);
      await audit('HAPUS', 'Regulasi', undefined, r);
    }
  }

  return (
    <>
      <PageTitle title="Regulasi & Dasar Hukum" desc="Regulasi yang menjadi rujukan penilaian PKPM"
        action={
          <div className="flex gap-2">
            <Button variant="light" onClick={seedDefaults}>Seed Default</Button>
            <Button onClick={() => setForm({ id: crypto.randomUUID(), nomor: '', tentang: '', tahun: new Date().getFullYear(), status: 'berlaku', catatan: '' })}>
              <Plus size={16} className="inline" /> Tambah
            </Button>
          </div>
        } />
      {form && (
        <Card className="mb-4">
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm">Nomor Regulasi
              <input className="input mt-1" value={(form.nomor||'')} onChange={e => setForm({ ...form, nomor: e.target.value })} placeholder="Contoh: PermenPANRB Nomor 7 Tahun 2026" />
            </label>
            <label className="text-sm">Tahun
              <input type="number" className="input mt-1" value={form.tahun} onChange={e => setForm({ ...form, tahun: Number(e.target.value) })} />
            </label>
            <label className="text-sm md:col-span-2">Tentang
              <input className="input mt-1" value={(form.tentang||'')} onChange={e => setForm({ ...form, tentang: e.target.value })} placeholder="Judul regulasi" />
            </label>
            <label className="text-sm">Status
              <select className="input mt-1" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Regulasi['status'] })}>
                {Object.keys(STATUS_COLORS).map(s => <option key={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </label>
            <label className="text-sm">Link (opsional)
              <input className="input mt-1" value={form.link || ''} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="URL regulasi" />
            </label>
            <label className="text-sm md:col-span-2">Catatan
              <textarea className="input mt-1" rows={3} value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} placeholder="Catatan penting..." />
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={save}>Simpan</Button>
            <Button variant="light" onClick={() => setForm(null)}>Batal</Button>
          </div>
        </Card>
      )}
      <Card>
        <input className="input mb-4" placeholder="Cari regulasi..." value={search} onChange={e => setSearch(e.target.value)} />
        {filtered.length === 0 ? (
          <p className="text-slate-400 text-center py-8">Belum ada regulasi. Klik "Seed Default" untuk mengisi data awal.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <div key={r.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen size={16} className="text-slate-400" />
                      <b className="text-[#173f70]">{r.nomor}</b>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status || 'berlaku'] || 'bg-slate-100'}`}>
                        {(r.status || 'berlaku').replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm">{r.tentang}</p>
                    {r.catatan && <p className="text-xs text-slate-500 mt-2 italic">{r.catatan}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {r.link && (
                      <a href={r.link} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                        <ExternalLink size={16} />
                      </a>
                    )}
                    <button onClick={() => setForm({ ...r })} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => del(r)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded text-sm">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}