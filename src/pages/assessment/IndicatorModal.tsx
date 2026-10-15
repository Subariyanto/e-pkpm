import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '../../components/Layout';
import { CATATAN_OTOMATIS, NA_NOTE } from '../../data/demo';
import type { Assessment, Indicator } from '../../types';

const TABS = ['Kunci Skor', 'Aspek yang Dinilai', 'Dokumen yang Disiapkan', 'Penggalian Data', 'Catatan dan Temuan', 'Rencana Tindak Lanjut'];

const Ta = ({ label, value, onChange, placeholder, locked }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; locked: boolean }) => (
  <label className="text-sm block mt-3">{label}
    <textarea disabled={locked} className="input mt-1 min-h-16" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
  </label>
);

export function IndicatorModal({
  ind, form, locked, isAdmin, onClose, onUpdate, onEditIndicator,
}: {
  ind: Indicator; form: Assessment; locked: boolean; isAdmin: boolean;
  onClose: () => void; onUpdate: (v: Partial<Assessment>) => void; onEditIndicator: () => void;
}) {
  const [tab, setTab] = useState(0);
  const aspekTotal = ind.aspek.length || 1;
  const aspekTerpenuhi = (form.aspekChecklist || []).filter(Boolean).length;
  const persenAspek = Math.round((aspekTerpenuhi / aspekTotal) * 100);
  const recommended = persenAspek >= 80 ? 2 : persenAspek >= 40 ? 1 : 0;

  const setAspek = (i: number, v: boolean) => {
    const next = [...(form.aspekChecklist || [])];
    while (next.length < ind.aspek.length) next.push(false);
    next[i] = v;
    const pct = Math.round((next.filter(Boolean).length / aspekTotal) * 100);
    onUpdate({ aspekChecklist: next, aspekPercent: pct, recommendedScore: pct >= 80 ? 2 : pct >= 40 ? 1 : 0 });
  };

  const setNA = (v: boolean) => {
    onUpdate({ na: v, naReason: v ? NA_NOTE : '', notes: v ? NA_NOTE : form.notes, score: v ? undefined : form.score });
  };

  const setScore = (s: number) => {
    const autoNote = CATATAN_OTOMATIS[s] || '';
    const prevAuto = CATATAN_OTOMATIS[form.score ?? -1];
    onUpdate({ score: s, notes: form.notes && form.notes !== prevAuto ? form.notes : autoNote, na: false, naReason: '' });
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
            </div>
          ) : tab === 1 ? (
            <div>
              <div className="space-y-2">
                {ind.aspek.map((a, i) => (
                  <label key={i} className="flex items-start gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" disabled={locked} checked={(form.aspekChecklist || [])[i] || false} onChange={e => setAspek(i, e.target.checked)} className="w-4 h-4 mt-0.5" />
                    <span className="text-sm">{a}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4 p-3 bg-slate-50 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
                <div><p className="text-xs text-slate-500">Terpenuhi</p><b className="text-emerald-600">{aspekTerpenuhi}</b></div>
                <div><p className="text-xs text-slate-500">Tidak Terpenuhi</p><b className="text-red-500">{aspekTotal - aspekTerpenuhi}</b></div>
                <div><p className="text-xs text-slate-500">Persentase</p><b className="text-teal-700">{persenAspek}%</b></div>
                <div><p className="text-xs text-slate-500">Rekomendasi Skor</p><b className="text-[#173f70]">{recommended}</b></div>
              </div>
              {form.score !== undefined && form.score !== recommended && (
                <label className="text-sm block mt-3">Alasan skor berbeda dari rekomendasi <span className="text-red-500">*</span>
                  <textarea disabled={locked} className="input mt-1" value={form.review} onChange={e => onUpdate({ review: e.target.value })} placeholder="Wajib diisi jika skor berbeda dari rekomendasi aspek" />
                </label>
              )}
            </div>
          ) : tab === 2 ? (
            <div>
              <p className="text-xs text-slate-500 mb-3">Penilai hanya memberi tanda dokumen ditemukan atau tidak ditemukan. Tidak ada unggah eviden.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-100"><th className="p-2 text-left">Nama Dokumen</th><th className="p-2 text-center">Ditemukan</th><th className="p-2 text-left">Nomor</th><th className="p-2 text-left">Tanggal</th><th className="p-2 text-left">Keterangan</th></tr></thead>
                  <tbody>
                    {ind.documents.map((doc, i) => {
                      const isMain = i === 0;
                      return (
                        <tr key={i} className="border-b">
                          <td className="p-2 whitespace-nowrap">{doc}</td>
                          <td className="p-2 text-center">
                            <input type="checkbox" disabled={locked} checked={isMain ? form.documentFound : false}
                              onChange={e => isMain && onUpdate({ documentFound: e.target.checked, documentName: doc })} className="w-4 h-4" />
                          </td>
                          <td className="p-2"><input disabled={locked || !isMain} className="input !py-1 text-xs" value={isMain ? form.documentNumber : ''} onChange={e => onUpdate({ documentNumber: e.target.value })} /></td>
                          <td className="p-2"><input type="date" disabled={locked || !isMain} className="input !py-1 text-xs" value={isMain ? form.documentDate : ''} onChange={e => onUpdate({ documentDate: e.target.value })} /></td>
                          <td className="p-2"><input disabled={locked || !isMain} className="input !py-1 text-xs" value={isMain ? form.documentStatus : ''} onChange={e => onUpdate({ documentStatus: e.target.value })} placeholder="Keterangan" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : tab === 3 ? (
            <div>
              <Ta locked={locked} label="Telaah Dokumen" value={form.telaahDokumen} onChange={v => onUpdate({ telaahDokumen: v })} placeholder="Hasil telaah dokumen..." />
              <Ta locked={locked} label="Wawancara / Klarifikasi" value={form.wawancara} onChange={v => onUpdate({ wawancara: v })} placeholder="Hasil wawancara atau klarifikasi..." />
              <Ta locked={locked} label="Konfirmasi kepada Madrasah Binaan" value={form.konfirmasi} onChange={v => onUpdate({ konfirmasi: v })} placeholder="Konfirmasi bila diperlukan..." />
              <Ta locked={locked} label="Pemeriksaan Konsistensi (Program–Pelaksanaan–Hasil–RTL)" value={form.konsistensi} onChange={v => onUpdate({ konsistensi: v })} placeholder="Konsistensi antara program, pelaksanaan, hasil, dan RTL..." />
              <Ta locked={locked} label="Hasil Penggalian / Temuan" value={form.finding} onChange={v => onUpdate({ finding: v })} placeholder="Temuan utama..." />
            </div>
          ) : tab === 4 ? (
            <div>
              <label className="text-sm block">Catatan Penilai <span className="text-xs text-slate-500">(terisi otomatis saat memilih skor, dapat diedit)</span>
                <textarea disabled={locked} className="input mt-1 min-h-20" value={form.notes} onChange={e => onUpdate({ notes: e.target.value })} />
              </label>
              <Ta locked={locked} label="Kekuatan" value={form.recommendation} onChange={v => onUpdate({ recommendation: v })} placeholder="Kekuatan yang ditemukan..." />
              <Ta locked={locked} label="Kekurangan / Ketidaksesuaian / Hasil Klarifikasi" value={form.review} onChange={v => onUpdate({ review: v })} placeholder="Kekurangan, ketidaksesuaian, atau hasil klarifikasi..." />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              <Ta locked={locked} label="Masalah / Kesenjangan" value={form.rtlMasalah} onChange={v => onUpdate({ rtlMasalah: v })} />
              <Ta locked={locked} label="Akar Masalah" value={form.rtlAkarMasalah} onChange={v => onUpdate({ rtlAkarMasalah: v })} />
              <Ta locked={locked} label="Tindakan Perbaikan" value={form.rtlTindakan} onChange={v => onUpdate({ rtlTindakan: v })} />
              <Ta locked={locked} label="Produk yang Harus Dihasilkan" value={form.rtlProduk} onChange={v => onUpdate({ rtlProduk: v })} />
              <label className="text-sm block">Bentuk PKB
                <select disabled={locked} className="input mt-1" value={form.rtlBentukPKB} onChange={e => onUpdate({ rtlBentukPKB: e.target.value })}>
                  <option value="">Pilih bentuk PKB</option>
                  {['Diklat', 'Workshop', 'Lokakarya', 'Seminar', 'KKG/MGMP', 'Mentoring/Coaching', 'Penelitian Tindakan', 'Publikasi Ilmiah', 'Lainnya'].map(x => <option key={x}>{x}</option>)}
                </select>
              </label>
              <label className="text-sm block">Target Waktu
                <input disabled={locked} className="input mt-1" value={form.rtlTarget} onChange={e => onUpdate({ rtlTarget: e.target.value })} placeholder="Contoh: Semester Ganjil 2026/2027" />
              </label>
              <label className="text-sm block">Penanggung Jawab
                <input disabled={locked} className="input mt-1" value={form.rtlPIC} onChange={e => onUpdate({ rtlPIC: e.target.value })} />
              </label>
              <label className="text-sm block">Bukti Penyelesaian
                <input disabled={locked} className="input mt-1" value={form.rtlBukti} onChange={e => onUpdate({ rtlBukti: e.target.value })} />
              </label>
              <label className="text-sm block">Status RTL
                <select disabled={locked} className="input mt-1" value={form.rtlStatus} onChange={e => onUpdate({ rtlStatus: e.target.value as Assessment['rtlStatus'] })}>
                  <option value="">Pilih status</option>
                  {['Belum dimulai', 'Berjalan', 'Selesai', 'Terverifikasi'].map(x => <option key={x}>{x}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>

        <div className="p-4 border-t shrink-0 bg-slate-50 rounded-b-xl">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${form.na ? 'bg-slate-200 text-slate-600' : form.score !== undefined ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'}`}>
                {form.na ? 'N/A — tidak dinilai' : form.score !== undefined ? `Skor: ${form.score}/2` : 'Belum diberi skor'}
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">Perubahan tersimpan otomatis saat berpindah indikator</span>
            </div>
            <div className="flex gap-2 ml-auto">
              {tab > 0 && <Button variant="light" onClick={() => setTab(tab - 1)}>Sebelumnya</Button>}
              {tab < TABS.length - 1
                ? <Button onClick={() => setTab(tab + 1)}>Berikutnya</Button>
                : <Button onClick={onClose}>Selesai</Button>}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 sm:hidden">Perubahan tersimpan otomatis saat berpindah indikator</p>
        </div>
      </div>
    </div>
  );
}
