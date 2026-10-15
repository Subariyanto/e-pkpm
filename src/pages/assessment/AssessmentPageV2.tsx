import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, audit } from '../../lib/db';
import { Button, Card, PageTitle } from '../../components/Layout';
import { saveResult, validateFinalization, indicatorsForJenjang, calculate, instrumenAktif } from '../../services/core';
import { CATATAN_OTOMATIS, NA_NOTE } from '../../data/demo';
import { STEPS, COMP_KEYS, emptyAssessment } from './helpers';
import { ProgressSteps } from './ProgressSteps';
import { IndicatorList } from './IndicatorList';
import { RHK_MAP } from '../../data/instruments-v2';
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
    () => indicatorsForJenjang(instrumenAktif(allIns), jenjang),
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

  /**
   * Hasil hitung langsung dari centang yang sedang di layar (belum disimpan).
   * Dipakai agar Nilai Akhir kanan atas ikut berubah begitu skor diklik.
   */
  const live = useMemo(() => {
    const rows = ins.map(i => {
      const f = forms[i.id] || {};
      return { ...emptyAssessment(pid, supervisor?.assessorId || 'u1', i.id), ...f, indicatorId: i.id } as Assessment;
    });
    return calculate(rows, ins);
  }, [ins, forms, pid, supervisor?.assessorId]);

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

  // === STEPS 1–4: Kartu penilaian gaya PKKM + panel ringkasan ===
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

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select className="input flex-1 min-w-[240px]" value={pid} onChange={e => { setPid(e.target.value); setStep(0); }}>
          <option value="">Pilih Pengawas yang Dinilai</option>
          {ps.map(p => <option value={p.id} key={p.id}>{p.name} — {p.level}</option>)}
        </select>
        {lastSaved && <span className="text-xs text-slate-400">Tersimpan: {lastSaved}</span>}

        {/* ===== Nilai Akhir — kanan atas ===== */}
        {pid && step >= 1 && (
          <div className="ml-auto text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Nilai Akhir</p>
            <p className="text-3xl font-extrabold text-[#173f70] leading-none my-1">
              {live.final.toFixed(2)}
            </p>
            <p className="text-sm font-semibold text-emerald-700">{live.predicate}</p>
            <p className="text-[11px] text-slate-500">Skala Skor 0–2</p>
          </div>
        )}
      </div>

      {pid && (
        <>
          <ProgressSteps step={step} setStep={setStep} done={stepDone} />

          {step >= 1 && (
            <IndicatorList
              indicators={stepIns}
              forms={forms}
              locked={!!locked}
              onScore={(id, s, noteLama) =>
                update(id, {
                  score: s,
                  notes: noteLama !== undefined ? noteLama : CATATAN_OTOMATIS[s],
                  na: false,
                  naReason: '',
                })
              }
              onOpenDetail={i => setActive(i)}
              rhkOf={code => RHK_MAP[code || '']}
            />
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
          buktiDukung={RHK_MAP[active.code || '']}
        />
      )}
    </>
  );
}
