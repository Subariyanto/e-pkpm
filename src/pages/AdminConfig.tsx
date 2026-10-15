import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, audit } from '../lib/db';
import { Button, Card, PageTitle } from '../components/Layout';
import type { Indicator, Period, PredikatRow, BobotKomponen } from '../types';
import { validatePredicates } from '../services/core';
import { BOBOT_DEFAULT, PREDIKAT_DEFAULT } from '../data/demo';

const Field = ({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: any) => void; type?: string }) => (
  <label className="text-sm">{label}<input type={type} className="input mt-1" value={value} onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} /></label>
);

const emptyIndicator = (): Indicator => ({
  id: crypto.randomUUID(), component: 'K1', code: '', title: '', description: '',
  documents: [], weight: 1, maxScore: 2, required: true, pkb: '', active: true, order: 1,
  jenjangBerlaku: ['Muda', 'Madya', 'Utama'],
  aspek: [''], kriteriaSkor: { 0: '', 1: '', 2: '' },
  metodeVerifikasi: [], rekomendasiPKB: '', rtlDefault: undefined,
  versiInstrumen: 'pkpm-0-2-v2', periodeMulai: '2026',
  subcomponent: '', descriptors: {},
});

export function InstrumentAdmin() {
  const data = useLiveQuery(() => db.indicators.orderBy('order').toArray(), []) || [];
  const [form, setForm] = useState<Indicator | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');

  async function save() {
    if (!form) return;
    const isV2 = form.versiInstrumen === 'pkpm-0-2-v2';
    if (!form.code.trim() || !(form.title||'').trim() || form.weight <= 0) return alert('Kode, judul, bobot wajib valid');
    if (isV2) {
      if ([0, 1, 2].some(s => !form.kriteriaSkor[s]?.trim())) return alert('Kriteria skor 0–2 wajib diisi');
      if (!(form.jenjangBerlaku||[]).length) return alert('Pilih minimal satu jenjang');
    } else {
      if (form.maxScore !== 4) return alert('Skor maksimum legacy harus 4');
      if ([0, 1, 2, 3, 4].some(s => !form.descriptors?.[s]?.trim())) return alert('Deskriptor skor 0–4 wajib diisi');
    }
    const duplicate = data.find(x => x.code.toLowerCase() === form.code.toLowerCase() && x.id !== form.id);
    if (duplicate) return alert('Kode instrumen sudah digunakan');
    const old = await db.indicators.get(form.id);
    await db.indicators.put(form);
    await audit(old ? 'UBAH' : 'TAMBAH', 'Instrumen', form, old);
    setForm(null);
  }

  async function del(x: Indicator) {
    if (await db.assessments.where('indicatorId').equals(x.id).count()) return alert('Instrumen telah dipakai dalam penilaian');
    if (confirm(`Hapus ${x.code}?`)) { await db.indicators.delete(x.id); await audit('HAPUS', 'Instrumen', undefined, x); }
  }

  const isV2 = form?.versiInstrumen === 'pkpm-0-2-v2';

  return (
    <>
      <PageTitle title="Master Instrumen, Bobot & Deskriptor" desc="CRUD tervalidasi dan tercatat pada audit"
        action={<Button onClick={() => setForm(emptyIndicator())}>Tambah Instrumen</Button>} />
      {form && (
        <Card className="mb-4">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setActiveTab('basic')} className={`px-3 py-1 text-sm rounded ${activeTab === 'basic' ? 'bg-teal-600 text-white' : 'bg-slate-100'}`}>Dasar</button>
            <button onClick={() => setActiveTab('advanced')} className={`px-3 py-1 text-sm rounded ${activeTab === 'advanced' ? 'bg-teal-600 text-white' : 'bg-slate-100'}`}>Lanjutan</button>
          </div>

          {activeTab === 'basic' ? (
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Kode" value={form.code} onChange={v => setForm({ ...form, code: v })} />
              <label className="text-sm">Komponen
                <select className="input mt-1" value={form.component} onChange={e => setForm({ ...form, component: e.target.value as Indicator['component'] })}>
                  {['K1', 'K2', 'K3', 'K4'].map(x => <option key={x}>{x}</option>)}
                </select>
              </label>
              <Field label="Urutan" type="number" value={form.order} onChange={v => setForm({ ...form, order: v })} />
              <Field label="Judul" value={form.title} onChange={v => setForm({ ...form, title: v })} />
              <Field label="Uraian" value={form.description} onChange={v => setForm({ ...form, description: v })} />
              <Field label="Versi Instrumen" value={form.versiInstrumen} onChange={v => setForm({ ...form, versiInstrumen: v, maxScore: v === 'pkpm-0-2-v2' ? 2 : 4 })} />
              <Field label="Bobot" type="number" value={form.weight} onChange={v => setForm({ ...form, weight: v })} />
              <Field label="Skor Maksimum" type="number" value={form.maxScore} onChange={v => setForm({ ...form, maxScore: v })} />
              <Field label="Dokumen (pisahkan koma)" value={form.documents.join(', ')} onChange={v => setForm({ ...form, documents: v.split(',').map((x: string) => x.trim()).filter(Boolean) })} />
              <Field label="Rekomendasi PKB" value={form.pkb} onChange={v => setForm({ ...form, pkb: v })} />
              <label className="text-sm">Jenjang Berlaku
                <div className="flex gap-3 mt-1">
                  {(['Muda', 'Madya', 'Utama'] as const).map(j => (
                    <label key={j} className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={(form.jenjangBerlaku||[]).includes(j)} onChange={e => {
                        const next = e.target.checked ? [...(form.jenjangBerlaku||[]), j] : (form.jenjangBerlaku||[]).filter(x => x !== j);
                        setForm({ ...form, jenjangBerlaku: next.filter(Boolean).length ? next : ['Madya'] });
                      }} /> {j}
                    </label>
                  ))}
                </div>
              </label>
              <label className="flex items-center gap-2 text-sm mt-5">
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Aktif
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="text-sm block">Aspek yang Dinilai (satu per baris)
                <textarea className="input mt-1" rows={4} value={form.aspek.join('\n')} onChange={e => setForm({ ...form, aspek: e.target.value.split('\n').filter(Boolean) })} />
              </label>
              {isV2 ? (
                <div className="grid md:grid-cols-3 gap-3">
                  {([0, 1, 2] as const).map(s => (
                    <label key={s} className="text-sm block">Kriteria Skor {s}
                      <textarea className="input mt-1" rows={3} value={form.kriteriaSkor[s] || ''} onChange={e => setForm({ ...form, kriteriaSkor: { ...form.kriteriaSkor, [s]: e.target.value } })} />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="grid md:grid-cols-5 gap-3">
                  {[0, 1, 2, 3, 4].map(s => (
                    <Field key={s} label={`Deskriptor skor ${s}`} value={form.descriptors?.[s] || ''} onChange={v => setForm({ ...form, descriptors: { ...form.descriptors, [s]: v } })} />
                  ))}
                </div>
              )}
              <label className="text-sm block">Metode Verifikasi (pisahkan koma)
                <input className="input mt-1" value={(form.metodeVerifikasi||[]).join(', ')} onChange={e => setForm({ ...form, metodeVerifikasi: e.target.value.split(',').map((x: string) => x.trim()).filter(Boolean) })} />
              </label>
              <Field label="RTL Default" value={form.rtlDefault} onChange={v => setForm({ ...form, rtlDefault: v })} />
              <Field label="Periode Mulai Berlaku" value={form.periodeMulai} onChange={v => setForm({ ...form, periodeMulai: v })} />
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button onClick={save}>Simpan</Button>
            <Button variant="light" onClick={() => setForm(null)}>Batal</Button>
          </div>
        </Card>
      )}
      <div className="space-y-3">
        {data.map(x => (
          <Card key={x.id}>
            <div className="flex justify-between gap-3">
              <div>
                <b>{x.code} · {x.title || x.description}</b>
                <p className="text-sm text-slate-500">{x.component} · Bobot {x.weight} · Maks. {x.maxScore} · Jenjang: {x.jenjangBerlaku?.join(', ') || 'Semua'} · {x.active ? 'Aktif' : 'Nonaktif'} · Versi: {x.versiInstrumen || 'legacy'}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="light" onClick={() => setForm({ ...x })}>Ubah</Button>
                <Button variant="danger" onClick={() => del(x)}>Hapus</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

export function ConfigAdmin() {
  const periods = useLiveQuery(async () => (await db.periods.toArray()).sort((a, b) => b.year - a.year), []) || [];
  const predicateSetting = useLiveQuery(() => db.settings.get('predicates'), []) as any;
  const bobotSetting = useLiveQuery(() => db.settings.get('bobotKomponen'), []) as any;
  const [period, setPeriod] = useState<Period | null>(null);
  const [predicates, setPredicates] = useState<PredikatRow[] | null>(null);
  const [bobot, setBobot] = useState<BobotKomponen | null>(null);

  async function savePeriod() {
    if (!period) return;
    if (period.year < 2000 || !period.schoolYear || !period.start || !period.end || period.start > period.end) return alert('Data/rentang periode tidak valid');
    const old = await db.periods.get(period.id);
    await db.periods.put(period);
    await audit(old ? 'UBAH' : 'TAMBAH', 'Periode', period, old);
    setPeriod(null);
  }

  async function delPeriod(x: Period) {
    if (await db.results.where('periodId').equals(x.id).count()) return alert('Periode telah memiliki hasil');
    if (confirm(`Hapus periode ${x.id}?`)) { await db.periods.delete(x.id); await audit('HAPUS', 'Periode', undefined, x); }
  }

  async function savePred() {
    if (!predicates || !validatePredicates(predicates)) return alert('Ambang harus menurun, unik, 0–100, label wajib, dan diakhiri nilai 0');
    const old = predicateSetting?.value;
    await db.settings.put({ key: 'predicates', value: predicates });
    await audit('UBAH', 'Predikat', predicates, old);
    setPredicates(null);
  }

  async function saveBobot() {
    if (!bobot) return;
    const total = (bobot.K1||0) + (bobot.K2||0) + (bobot.K3||0) + (bobot.K4||0);
    if (total !== 100) return alert(`Total bobot harus 100 (saat ini ${total})`);
    const old = bobotSetting?.value;
    await db.settings.put({ key: 'bobotKomponen', value: bobot });
    await audit('UBAH', 'Bobot Komponen', bobot, old);
    setBobot(null);
  }

  const currentPredicates = predicates || (predicateSetting?.value as PredikatRow[]) || PREDIKAT_DEFAULT;
  const currentBobot = bobot || (bobotSetting?.value as BobotKomponen) || BOBOT_DEFAULT;

  return (
    <>
      <PageTitle title="Periode, Predikat & Bobot" desc="Konfigurasi tervalidasi dan diaudit" />
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Periode */}
        <Card>
          <div className="flex justify-between">
            <b>Periode Penilaian</b>
            <Button onClick={() => setPeriod({ id: String(new Date().getFullYear()), year: new Date().getFullYear(), schoolYear: '', start: '', end: '', status: 'draft' })}>Tambah</Button>
          </div>
          {period && (
            <div className="grid grid-cols-2 gap-2 my-4">
              <Field label="ID" value={period.id} onChange={v => setPeriod({ ...period, id: v })} />
              <Field label="Tahun" type="number" value={period.year} onChange={v => setPeriod({ ...period, year: v })} />
              <Field label="Tahun Pelajaran" value={period.schoolYear} onChange={v => setPeriod({ ...period, schoolYear: v })} />
              <Field label="Mulai" type="date" value={period.start} onChange={v => setPeriod({ ...period, start: v })} />
              <Field label="Selesai" type="date" value={period.end} onChange={v => setPeriod({ ...period, end: v })} />
              <label className="text-sm">Status
                <select className="input mt-1" value={period.status} onChange={e => setPeriod({ ...period, status: e.target.value as Period['status'] })}>
                  {['draft', 'active', 'closed', 'locked'].map(x => <option key={x}>{x}</option>)}
                </select>
              </label>
              <Button onClick={savePeriod}>Simpan</Button>
            </div>
          )}
          {periods.map(x => (
            <div className="flex justify-between border-t py-3" key={x.id}>
              <span><b>{x.id}</b> · {x.schoolYear} · {x.status}</span>
              <span className="flex gap-1">
                <Button variant="light" onClick={() => setPeriod({ ...x })}>Ubah</Button>
                <Button variant="danger" onClick={() => delPeriod(x)}>Hapus</Button>
              </span>
            </div>
          ))}
        </Card>

        {/* Predikat */}
        <Card>
          <div className="flex justify-between">
            <b>Ambang Predikat</b>
            <Button onClick={() => setPredicates([...currentPredicates])}>Ubah</Button>
          </div>
          {currentPredicates.map((x: PredikatRow, i: number) => (
            <div className="grid grid-cols-2 gap-2 mt-3" key={i}>
              <input disabled={!predicates} type="number" className="input" value={x.min} onChange={e => {
                const a = [...(predicates || [])]; a[i] = { ...a[i], min: Number(e.target.value) }; setPredicates(a);
              }} />
              <input disabled={!predicates} className="input" value={x.label} onChange={e => {
                const a = [...(predicates || [])]; a[i] = { ...a[i], label: e.target.value }; setPredicates(a);
              }} />
            </div>
          ))}
          {predicates && <div className="mt-3"><Button onClick={savePred}>Simpan Predikat</Button></div>}
        </Card>

        {/* Bobot Komponen */}
        <Card>
          <div className="flex justify-between">
            <b>Bobot Komponen (%)</b>
            <Button onClick={() => setBobot({ ...currentBobot })}>Ubah</Button>
          </div>
          <div className="space-y-3 mt-3">
            {(['K1', 'K2', 'K3', 'K4'] as const).map(k => (
              <div key={k} className="flex items-center gap-3">
                <span className="w-10 text-sm font-bold">{k}</span>
                <input type="range" disabled={!bobot} min={0} max={100} value={currentBobot[k]} className="flex-1"
                  onChange={e => {
                    if (!bobot) return;
                    const next = { ...bobot, [k]: Number(e.target.value) };
                    setBobot(next);
                  }} />
                <span className="w-10 text-sm text-right">{currentBobot[k]}%</span>
              </div>
            ))}
            <p className="text-xs text-slate-500">Total: {(currentBobot.K1||0) + (currentBobot.K2||0) + (currentBobot.K3||0) + (currentBobot.K4||0)}% (harus 100%)</p>
          </div>
          {bobot && <div className="mt-3"><Button onClick={saveBobot}>Simpan Bobot</Button></div>}
        </Card>
      </div>
    </>
  );
}