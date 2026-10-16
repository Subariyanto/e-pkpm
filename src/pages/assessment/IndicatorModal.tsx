import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '../../components/Layout';
import { CATATAN_OTOMATIS, NA_NOTE, AUTO_ISI } from '../../data/demo';
import type { Assessment, Indicator } from '../../types';

const TABS = ['Kunci Skor', 'Bukti Dukung'];

export function IndicatorModal({
  ind, form, locked, isAdmin, onClose, onUpdate, onEditIndicator, buktiDukung,
}: {
  ind: Indicator; form: Assessment; locked: boolean; isAdmin: boolean;
  onClose: () => void; onUpdate: (v: Partial<Assessment>) => void; onEditIndicator: () => void;
  /** Daftar bukti dukung dari e-RHK (keterangan RHK) untuk indikator ini. */
  buktiDukung?: { no: number; tw: string; nama: string }[];
}) {
  const [tab, setTab] = useState(0);

  const setNA = (v: boolean) => {
    onUpdate({ na: v, naReason: v ? NA_NOTE : '', notes: v ? NA_NOTE : form.notes, score: v ? undefined : form.score });
  };

  /** Pilih skor sekaligus isi otomatis catatan (ringkas) dari skor terpilih. */
  const setScore = (s: number) => {
    const auto = AUTO_ISI[s];
    onUpdate({
      score: s,
      na: false,
      naReason: '',
      notes: auto?.notes || CATATAN_OTOMATIS[s] || '',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-xl shadow-xl w-full md:max-w-4xl max-h-[95vh] md:max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-start shrink-0">
          <div>
            <h2 className="font-bold text-lg text-[#173f70]">{ind.code} — {ind.title}</h2>
            <p className="text-sm text-slate-600">{ind.description}</p>
            <p className="text-xs text-slate-400 mt-1">Jenjang: {(ind.jenjangBerlaku || ind.levels || []).join(', ')} · Bobot: {ind.weight} · Versi: {ind.versiInstrumen}</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && <button onClick={onEditIndicator} className="text-slate-400 hover:text-blue-600" title="Edit Indikator (Admin)"><Pencil size={18} /></button>}
            <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-700 leading-none">×</button>
          </div>
        </div>

        <div className="px-4 py-2 bg-slate-50 border-b flex items-center gap-3 shrink-0 flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.na} disabled={locked} onChange={e => setNA(e.target.checked)} className="w-4 h-4" />
            <b>N/A — Tidak Berlaku</b>
          </label>
          {form.na && <span className="text-xs text-slate-500">{NA_NOTE}</span>}
        </div>

        {!form.na && (
          <div className="px-4 py-2 bg-slate-50 border-b flex items-center gap-2 shrink-0 flex-wrap">
            <span className="text-xs text-slate-600">
              Catatan Hasil Penilaian dan Rencana Tindak Lanjut dihitung otomatis dari skor seluruh komponen
              dan disajikan pada halaman <b>Cetak Instrumen</b>.
            </span>
          </div>
        )}

        <div className="flex border-b overflow-x-auto shrink-0 tab-scroll">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              aria-current={tab === i ? 'step' : undefined}
              className={`relative shrink-0 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${tab === i ? 'border-teal-600 text-teal-700 bg-teal-50/60' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              <span className="inline-flex items-center gap-1.5">
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${tab === i ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{i + 1}</span>
                {t}
              </span>
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          {form.na ? (
            <div className="text-center py-10 text-slate-400">
              <p className="text-lg font-semibold">Indikator berstatus Tidak Berlaku (N/A)</p>
              <p className="text-sm mt-2">{NA_NOTE}</p>
              <p className="text-sm mt-1">Indikator ini tidak masuk perhitungan nilai.</p>
              <label className="text-sm block mt-4 max-w-md mx-auto text-left">Alasan N/A
                <textarea disabled={locked} className="input mt-1" value={form.naReason} onChange={e => onUpdate({ naReason: e.target.value })} />
              </label>
            </div>
          ) : tab === 0 ? (
            <div className="space-y-3">
              {([0, 1, 2] as const).map(s => (
                <div key={s} className={`p-3 rounded-lg border ${form.score === s ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-slate-50'}`}>
                  <b className="text-sm text-[#173f70]">Skor {s}</b>
                  <p className="text-sm text-slate-600 mt-1">{ind.kriteriaSkor[s]}</p>
                  {ind.contohKondisi?.[s] && <p className="text-xs text-slate-400 mt-1">Contoh: {ind.contohKondisi[s]}</p>}
                </div>
              ))}
              <div className="mt-4">
                <b className="text-sm">Pilih Skor</b>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {([0, 1, 2] as const).map(s => (
                    <button type="button" key={s} disabled={locked} onClick={() => setScore(s)}
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${form.score === s ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 hover:border-teal-400'}`}>
                      <b className="text-xl">{s}</b>
                    </button>
                  ))}
                </div>
              </div>
              <label className="text-sm block mt-4">Catatan <span className="text-xs text-slate-500">(opsional, terisi otomatis dari skor)</span>
                <textarea disabled={locked} className="input mt-1 min-h-20" value={form.notes} onChange={e => onUpdate({ notes: e.target.value })} />
              </label>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-500 mb-3">
                Bukti dukung yang perlu disiapkan pengawas. Penilai cukup memastikan dokumen tersedia pada bundel.
              </p>

              {/* ==== Bukti dukung dari e-RHK ==== */}
              {buktiDukung && buktiDukung.length > 0 && (
                <div className="mb-4 rounded-lg border-2 border-blue-200 bg-blue-50/60 p-3">
                  <p className="text-sm font-bold text-[#173f70] mb-2">Bukti Dukung dari e-RHK</p>
                  <ul className="space-y-2">
                    {buktiDukung.map(b => (
                      <li key={b.no} className="flex items-start gap-2 text-sm">
                        <span className="font-bold text-blue-700 shrink-0">RHK-{b.no}</span>
                        <span className="text-xs text-slate-400 shrink-0 pt-0.5">({b.tw})</span>
                        <span className="text-slate-700">{b.nama}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ==== Daftar dokumen indikator ==== */}
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <p className="text-sm font-bold text-[#173f70]">Dokumen yang Disiapkan</p>
                {(() => {
                  const total = ind.documents.length;
                  const jumlah = ind.documents.reduce((n, _d, k) => n + ((form.dokumenDitemukan || {})[`${ind.id}:${k}`] ? 1 : 0), 0);
                  return (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${jumlah === 0 ? 'bg-slate-100 text-slate-500' : jumlah === total ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {jumlah} dari {total} ditemukan
                    </span>
                  );
                })()}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-100"><th className="p-2 text-left w-10">No</th><th className="p-2 text-left">Nama Dokumen</th><th className="p-2 text-center w-28">Ditemukan</th></tr></thead>
                  <tbody>
                    {ind.documents.map((doc, i) => {
                      const key = `${ind.id}:${i}`;
                      const checked = !!form.dokumenDitemukan?.[key];
                      return (
                        <tr key={i} className="border-b">
                          <td className="p-2 text-slate-400">{i + 1}.</td>
                          <td className="p-2">{doc}</td>
                          <td className="p-2 text-center">
                            <input type="checkbox" disabled={locked} checked={checked}
                              onChange={e => {
                                const map = { ...(form.dokumenDitemukan || {}), [key]: e.target.checked };
                                const jumlah = ind.documents.reduce((n, _d, k) => n + (map[`${ind.id}:${k}`] ? 1 : 0), 0);
                                const utama = !!map[`${ind.id}:0`] ? form.documentName || ind.documents[0] : '';
                                onUpdate({
                                  dokumenDitemukan: map,
                                  dokumenJumlah: jumlah,
                                  dokumenTotal: ind.documents.length,
                                  documentFound: jumlah > 0,
                                  documentName: utama,
                                });
                              }} className="w-4 h-4" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t shrink-0 bg-slate-50 rounded-b-xl">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${form.na ? 'bg-slate-200 text-slate-600' : form.score !== undefined ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'}`}>
              {form.na ? 'N/A — tidak dinilai' : form.score !== undefined ? `Skor: ${form.score}/2` : 'Belum diberi skor'}
            </span>
            <div className="flex gap-2 ml-auto">
              {tab > 0 && <Button variant="light" onClick={() => setTab(tab - 1)}>Sebelumnya</Button>}
              {tab < TABS.length - 1
                ? <Button onClick={() => setTab(tab + 1)}>Berikutnya</Button>
                : <Button onClick={onClose}>Selesai</Button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
