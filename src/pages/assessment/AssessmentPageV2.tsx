import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, audit } from '../../lib/db';
import { Button, Card, PageTitle } from '../../components/Layout';
import { saveResult, validateFinalization, indicatorsForJenjang } from '../../services/core';
import { CATATAN_OTOMATIS, NA_NOTE } from '../../data/demo';
import { STEPS, COMP_KEYS, emptyAssessment } from './helpers';
import { ProgressSteps } from './ProgressSteps';
import { IndicatorModal } from './IndicatorModal';
import type { Assessment, Indicator } from '../../types';
import { Search, ChevronRight, ChevronLeft, Save, CheckCircle2 } from 'lucide-react';

export function AssessmentPageV2() {
  const ps = useLiveQuery(() => db.supervisors.toArray(), []) || [];
  const allIns = useLiveQuery(() => db.indicators.orderBy('order').toArray(), []) || [];
  const roles = (sessionStorage.getItem('roles') || '').split(',');
  const isAdmin = roles.includes('admin');

  const [pid, setPid] = useState('');
  const [step, setStep] = useState(0);
  const [active, setActive] = useState<Indicator | null>(null);
  const [forms, setForms] = useState<Record<string, Partial<Assessment>>>({});
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [skNumber, setSkNumber] = useState('');
  const [skDate, setSkDate] = useState('');

  const supervisor = ps.find(x => x.id === pid);
  const jenjang = (supervisor?.level || 'Madya') as 'Muda' | 'Madya' | 'Utama';

  const ins = useMemo(
    () => indicatorsForJenjang(allIns.filter(i => i.versiInstrumen === 'pkpm-0-2-v2'), jenjang),
    [allIns, jenjang],
  );
  const stepIns = step >= 1 ? ins.filter(i => i.component === COMP_KEYS[step - 1]) : [];

  const existing = useLiveQuery<Assessment[]>(
    () => (pid ? db.assessments.where('supervisorId').equals(pid).toArray() : Promise.resolve([] as Assessment[])),
    [pid],
  ) || [];

  useEffect(() => {
    setForms(Object.fromEntries(existing.map(x => [x.indicatorId, x])));
  }, [existing.length, pid]);

  const result = useLiveQuery(() => (pid ? db.results.get(`2026-${pid}`) : undefined), [pid]);
  const locked = result?.status === 'final';

  const update = useCallback((id: string, v: Partial<Assessment>) => {
    setForms(x => ({ ...x, [id]: { ...x[id], ...v } }));
  }, []);

  const stepDone = useMemo(() => {
    const done = [!!pid];
    for (let c = 0; c < 4; c++) {
      const compIns = ins.filter(i => i.component === COMP_KEYS[c]);
      done[c + 1] = compIns.length > 0 && compIns.every(i => {
        const f = forms[i.id];
        return f && (f.na || f.score !== undefined);
      });
    }
    return done;
  }, [pid, ins, forms]);

  function buildRows(): Assessment[] {
    return ins.map(i => {
      const f = forms[i.id] || {};
      const base = emptyAssessment(pid, supervisor?.assessorId || 'u1', i.id);
      return { ...base, ...f, id: `${pid}-${i.id}`, supervisorId: pid, assessorId: supervisor?.assessorId || 'u1', periodId: '2026', indicatorId: i.id, updatedAt: new Date().toISOString() } as Assessment;
    });
  }

  async function save(final = false) {
    if (!pid) return;
    setSaving(true);
    try {
      const rows = buildRows();
      if (final) {
        const errors = validateFinalization(rows, ins);
        if (errors.length) { alert('Finalisasi ditolak:\n\n' + errors.map(e => `• ${e}`).join('\n')); return; }
        if (!skNumber.trim()) { alert('Nomor SK/surat tugas penugasan wajib diisi sebelum finalisasi.'); return; }
      }
      await db.assessments.bulkPut(rows);
      await saveResult(pid, supervisor?.assessorId || 'u1', rows, ins, final, { skPenugasan: skNumber, tanggalSk: skDate });
      setLastSaved(new Date().toLocaleTimeString('id-ID'));
      if (final) {
        await audit('FINALISASI', `Penilaian ${supervisor?.name}`, { sk: skNumber });
        alert('Penilaian difinalisasi dan dikunci.');
      }
    } finally { setSaving(false); }
  }

  async function resetComponent() {
    if (!pid || step < 1) return;
    const comp = COMP_KEYS[step - 1];
    const compIns = ins.filter(i => i.component === comp);
    if (!confirm(`Reset seluruh skor komponen ${comp} untuk pengawas ini?\n\nSnapshot akan disimpan sebelum reset.`)) return;
    const snapshot = compIns.map(i => forms[i.id]).filter(Boolean);
    await db.settings.put({ key: `snapshot-${pid}-${comp}-${Date.now()}`, value: snapshot });
    setForms(x => {
      const next = { ...x };
      for (const i of compIns) next[i.id] = { ...next[i.id], score: undefined, notes: '', na: false, naReason: '' };
      return next;
    });
    await audit('RESET_SKOR', `${comp} — ${supervisor?.name}`, undefined, undefined, 'Reset komponen aktif');
  }

  // === STEP 0: Identitas dan Penugasan ===
  if (pid && step === 0) {
    return (
      <>
        <PageTitle title="Penilaian Saya" desc="Identitas dan Penugasan" />
        <ProgressSteps step={step} setStep={setStep} done={stepDone} />
        <Card>
          <h3 className="font-bold text-[#173f70] mb-4">Identitas Pengawas yang Dinilai</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">Nama</span><p className="font-semibold">{supervisor?.name}</p></div>
            <div><span className="text-slate-500">NIP</span><p className="font-semibold">{supervisor?.nip}</p></div>
            <div><span className="text-slate-500">Pangkat/Golongan</span><p className="font-semibold">{supervisor?.rank || '-'}</p></div>
            <div><span className="text-slate-500">Jenjang Jabatan</span><p className="font-semibold">{jenjang}</p></div>
            <div><span className="text-slate-500">Satuan Kerja</span><p className="font-semibold">{supervisor?.workUnit || '-'}</p></div>
            <div><span className="text-slate-500">Wilayah Binaan</span><p className="font-semibold">{supervisor?.region || '-'}</p></div>
          </div>
        </Card>
        <Card className="mt-4">
          <h3 className="font-bold text-[#173f70] mb-4">Penugasan Penilaian</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm">Nomor SK / Surat Tugas <span className="text-red-500">*</span>
              <input disabled={locked} className="input mt-1" value={skNumber} onChange={e => setSkNumber(e.target.value)} placeholder="Nomor SK penugasan" />
            </label>
            <label className="text-sm">Tanggal SK
              <input type="date" disabled={locked} className="input mt-1" value={skDate} onChange={e => setSkDate(e.target.value)} />
            </label>
          </div>
          <p className="text-xs text-slate-500 mt-3">Mekanisme penilaian: individual (satu penilai per pengawas)</p>
        </Card>
        <div className="flex justify-end gap-3 mt-4">
          <Button onClick={() => save().then(() => setStep(1))} disabled={locked || saving}>
            Simpan dan Lanjutkan <ChevronRight size={16} className="inline" />
          </Button>
        </div>
      </>
    );
  }

  // === STEPS 1–4: Tabel Penilaian ===
  return (
    <>
      <PageTitle
        title="Penilaian Saya"
        desc={pid ? `${supervisor?.name} — ${jenjang}` : 'Pilih pengawas yang dinilai'}
        action={pid && step >= 1 && !locked ? (
          <div className="flex gap-2">
            <Button variant="danger" onClick={resetComponent}>Reset Skor {COMP_KEYS[step - 1]}</Button>
          </div>
        ) : undefined}
      />

      <Card className="mb-4">
        <select className="input" value={pid} onChange={e => { setPid(e.target.value); setStep(0); }}>
          <option value="">Pilih Pengawas yang Dinilai</option>
          {ps.map(p => <option value={p.id} key={p.id}>{p.name} — {p.level}</option>)}
        </select>
      </Card>

      {pid && (
        <>
          <ProgressSteps step={step} setStep={setStep} done={stepDone} />

          {step >= 1 && (
            <Card>
              <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-[#173f70]">{STEPS[step]}</h3>
                  <p className="text-xs text-slate-500">Klik indikator untuk membuka detail penggalian data</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge">Skala Skor 0–2</span>
                  {lastSaved && <span className="text-xs text-slate-400">Tersimpan: {lastSaved}</span>}
                </div>
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-3 text-left w-10">No</th>
                      <th className="p-3 text-left">Indikator</th>
                      <th className="p-3 text-center w-14">0</th>
                      <th className="p-3 text-center w-14">1</th>
                      <th className="p-3 text-center w-14">2</th>
                      <th className="p-3 text-left w-64">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stepIns.map((i, n) => {
                      const f = forms[i.id] || {};
                      const isNA = f.na;
                      return (
                        <tr key={i.id} className={`border-b ${isNA ? 'bg-slate-100 text-slate-400' : ''}`}>
                          <td className="p-3">{n + 1}</td>
                          <td className="p-3">
                            <button type="button" disabled={locked} onClick={() => setActive(i)} className="text-left group">
                              <span className="text-blue-600 group-hover:underline text-sm font-medium">{i.code} — {i.title}</span>
                              <Search size={13} className="inline ml-1 text-slate-400" />
                              {isNA && <span className="ml-2 text-xs bg-slate-300 text-slate-600 px-2 py-0.5 rounded-full">N/A</span>}
                            </button>
                          </td>
                          {([0, 1, 2] as const).map(s => (
                            <td key={s} className="p-3 text-center">
                              <input type="radio" name={`score-${i.id}`} disabled={locked || isNA} checked={f.score === s}
                                onChange={() => update(i.id, { score: s, notes: f.notes && f.notes !== CATATAN_OTOMATIS[f.score ?? -1] ? f.notes : CATATAN_OTOMATIS[s], na: false, naReason: '' })}
                                className="w-4 h-4 accent-teal-600" />
                            </td>
                          ))}
                          <td className="p-3">
                            <textarea disabled={locked || isNA} className="input !py-1 text-xs min-h-[40px]" value={f.notes || ''}
                              placeholder={isNA ? NA_NOTE : 'Catatan otomatis saat memilih skor'}
                              onChange={e => update(i.id, { notes: e.target.value })} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {stepIns.map((i, n) => {
                  const f = forms[i.id] || {};
                  const isNA = f.na;
                  return (
                    <div key={i.id} className={`border rounded-lg p-3 ${isNA ? 'bg-slate-100' : ''}`}>
                      <button type="button" disabled={locked} onClick={() => setActive(i)} className="text-left w-full">
                        <span className="text-blue-600 text-sm font-medium">{n + 1}. {i.code} — {i.title}</span>
                        <Search size={13} className="inline ml-1 text-slate-400" />
                        {isNA && <span className="ml-2 text-xs bg-slate-300 text-slate-600 px-2 py-0.5 rounded-full">N/A</span>}
                      </button>
                      <div className="flex gap-2 mt-2">
                        {([0, 1, 2] as const).map(s => (
                          <button key={s} type="button" disabled={locked || isNA}
                            onClick={() => update(i.id, { score: s, notes: f.notes && f.notes !== CATATAN_OTOMATIS[f.score ?? -1] ? f.notes : CATATAN_OTOMATIS[s], na: false, naReason: '' })}
                            className={`flex-1 py-2 rounded-lg border-2 text-center text-sm font-bold ${f.score === s ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300'}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                      <textarea disabled={locked || isNA} className="input !py-1 text-xs mt-2 min-h-[36px]" value={f.notes || ''}
                        placeholder={isNA ? NA_NOTE : 'Catatan'} onChange={e => update(i.id, { notes: e.target.value })} />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-4">
            <Button variant="light" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
              <ChevronLeft size={16} className="inline" /> Kembali
            </Button>
            <div className="flex gap-2">
              <Button variant="light" onClick={() => save()} disabled={saving}>
                <Save size={16} className="inline" /> Simpan
              </Button>
              {step < 4 ? (
                <Button onClick={() => save().then(() => setStep(step + 1))} disabled={saving}>
                  Lanjut <ChevronRight size={16} className="inline" />
                </Button>
              ) : (
                <Button variant="primary" onClick={() => save(true)} disabled={saving || locked}>
                  <CheckCircle2 size={16} className="inline" /> {locked ? 'Sudah Final' : 'Finalisasi'}
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      {active && (
        <IndicatorModal
          ind={active}
          form={(forms[active.id] || emptyAssessment(pid, supervisor?.assessorId || 'u1', active.id)) as Assessment}
          locked={!!locked}
          isAdmin={isAdmin}
          onClose={() => setActive(null)}
          onUpdate={v => update(active.id, v)}
          onEditIndicator={() => { setActive(null); /* navigate to admin config */ }}
        />
      )}
    </>
  );
}
