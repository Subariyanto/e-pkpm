import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { Button, Card, PageTitle } from '../components/Layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { Assessment, Indicator, Result, Supervisor } from '../types';
import { calculate, computePriorities, indicatorsForJenjang } from '../services/core';
import { PREDIKAT_DEFAULT, BOBOT_DEFAULT } from '../data/demo';
import { generateIndividualPdf, generateKetuaPdf, downloadBlob } from '../services/pdfReport';
import { FileText, Download } from 'lucide-react';

const COLORS = ['#0d9488', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

export function DashboardV2() {
  const ps = useLiveQuery(() => db.supervisors.toArray(), []) || [];
  const allIns = useLiveQuery(() => db.indicators.orderBy('order').toArray(), []) || [];
  const results = useLiveQuery(() => db.results.toArray(), []) || [];
  const assessments = useLiveQuery(() => db.assessments.toArray(), []) || [];
  const regulasi = useLiveQuery(() => db.regulasi.toArray(), []) || [];
  const org = useLiveQuery(() => db.org.toCollection().first(), []);
  const [exporting, setExporting] = useState(false);

  const resultMap = useMemo(() => Object.fromEntries(results.map(r => [r.supervisorId, r])), [results]);
  const insV2 = useMemo(() => allIns.filter(i => i.versiInstrumen === 'pkpm-0-2-v2'), [allIns]);

  const stats = useMemo(() => {
    const total = ps.length;
    const done = results.filter(r => r.status === 'final').length;
    const inProgress = results.filter(r => r.status === 'process').length;
    const notStarted = total - done - inProgress;

    const predCount: Record<string, number> = {};
    for (const r of results) {
      if (r.predicate) predCount[r.predicate] = (predCount[r.predicate] || 0) + 1;
    }
    const predData = PREDIKAT_DEFAULT.map(p => ({ name: p.label, value: predCount[p.label] || 0 }));

    const compAvg: Record<string, number> = {};
    for (const c of ['K1', 'K2', 'K3', 'K4']) {
      const vals = results.filter(r => r.componentScores?.[c] !== undefined).map(r => r.componentScores[c]);
      compAvg[c] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0;
    }

    return { total, done, inProgress, notStarted, predData, compAvg };
  }, [ps, results]);

  const barData = ['K1', 'K2', 'K3', 'K4'].map(c => ({
    name: c,
    value: (stats.compAvg as Record<string,number>)[c],
    bobot: (BOBOT_DEFAULT as unknown as Record<string,number>)[c],
  }));

  async function exportIndividual(result: Result, supervisor?: Supervisor) {
    if (!supervisor) return;
    const items = assessments.filter(a => a.supervisorId === supervisor.id);
    const jenjang = supervisor.level || 'Madya';
    const ins = indicatorsForJenjang(insV2, jenjang);
    const blob = await generateIndividualPdf(supervisor, items, ins, result, regulasi, org || { name: 'Pokjawas Jember', chairman: '', headOffice: '' });
    downloadBlob(blob, `PKPM_${supervisor.name.replace(/\s/g, '_')}_${result.id}.pdf`);
  }

  async function exportKetua() {
    setExporting(true);
    try {
      const data = results
        .filter(r => r.status === 'final')
        .map(r => {
          const supervisor = ps.find(s => s.id === r.supervisorId);
          if (!supervisor) return null;
          const items = assessments.filter(a => a.supervisorId === supervisor.id);
          const jenjang = supervisor.level || 'Madya';
          const ins = indicatorsForJenjang(insV2, jenjang);
          const calc = calculate(items, ins, PREDIKAT_DEFAULT, BOBOT_DEFAULT);
          return { supervisor, result: r, calc };
        })
        .filter(Boolean) as { supervisor: Supervisor; result: Result; calc: ReturnType<typeof calculate> }[];
      const blob = await generateKetuaPdf(data, org || { name: 'Pokjawas Jember', chairman: '', headOffice: '' });
      downloadBlob(blob, `Rekap_PKPM_Ketua_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally { setExporting(false); }
  }

  return (
    <>
      <PageTitle title="Dashboard" desc="Ringkasan penilaian PKPM"
        action={
          <div className="flex gap-2">
            <Button variant="light" onClick={exportKetua} disabled={exporting}>
              <FileText size={16} className="inline" /> Rekap Ketua
            </Button>
          </div>
        } />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="text-center">
          <p className="text-3xl font-bold text-[#173f70]">{stats.total}</p>
          <p className="text-sm text-slate-500">Total Pengawas</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-emerald-600">{stats.done}</p>
          <p className="text-sm text-slate-500">Sudah Final</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-amber-500">{stats.inProgress}</p>
          <p className="text-sm text-slate-500">Dalam Proses</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-slate-400">{stats.notStarted}</p>
          <p className="text-sm text-slate-500">Belum Dinilai</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <h3 className="font-bold text-[#173f70] mb-4">Rata-rata Nilai per Komponen</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(v) => Number(v).toFixed(1)} />
              <Bar dataKey="value" fill="#0d9488" radius={[4, 4, 0, 0]} name="Nilai" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="font-bold text-[#173f70] mb-4">Distribusi Predikat</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={stats.predData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                {stats.predData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent Results */}
      <Card>
        <h3 className="font-bold text-[#173f70] mb-4">Hasil Penilaian Terbaru</h3>
        {results.length === 0 ? (
          <p className="text-slate-400 text-center py-8">Belum ada hasil penilaian</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-3 text-left">Nama</th>
                  <th className="p-3 text-left">Jenjang</th>
                  <th className="p-3 text-center">K1</th>
                  <th className="p-3 text-center">K2</th>
                  <th className="p-3 text-center">K3</th>
                  <th className="p-3 text-center">K4</th>
                  <th className="p-3 text-center">Akhir</th>
                  <th className="p-3 text-center">Predikat</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => {
                  const s = ps.find(x => x.id === r.supervisorId);
                  return (
                    <tr key={r.id} className="border-b">
                      <td className="p-3 font-medium">{s?.name || '-'}</td>
                      <td className="p-3">{s?.level || '-'}</td>
                      <td className="p-3 text-center">{r.componentScores?.K1?.toFixed(1) || '-'}</td>
                      <td className="p-3 text-center">{r.componentScores?.K2?.toFixed(1) || '-'}</td>
                      <td className="p-3 text-center">{r.componentScores?.K3?.toFixed(1) || '-'}</td>
                      <td className="p-3 text-center">{r.componentScores?.K4?.toFixed(1) || '-'}</td>
                      <td className="p-3 text-center font-bold">{r.finalScore?.toFixed(2) || '-'}</td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          r.predicate === 'Amat Baik' ? 'bg-emerald-100 text-emerald-800' :
                          r.predicate === 'Baik' ? 'bg-blue-100 text-blue-800' :
                          r.predicate === 'Cukup' ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>{r.predicate || '-'}</span>
                      </td>
                      <td className="p-3 text-center">
                        {r.status === 'final' ? '🔒' : '📝'}
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => exportIndividual(r, s)} className="text-blue-600 hover:underline text-xs">
                          <Download size={14} className="inline" /> PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}