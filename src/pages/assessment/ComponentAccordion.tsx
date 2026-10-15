import { useMemo, useState } from 'react';
import type { Assessment, Indicator } from '../../types';
import { CATATAN_OTOMATIS } from '../../data/demo';
import { ChevronDown, ChevronRight, Info, Search } from 'lucide-react';

/** Skor 0–2 tetap. Tampilan mengikuti gaya kartu PKKM. */
const SKALA = [0, 1, 2] as const;

type Props = {
  /** Seluruh indikator pada komponen yang sedang aktif (satu komponen). */
  indicators: Indicator[];
  forms: Record<string, Partial<Assessment>>;
  locked: boolean;
  onScore: (id: string, score: 0 | 1 | 2, noteLama?: string, skorLama?: number) => void;
  onOpenDetail: (i: Indicator) => void;
};

/** Nilai komponen: rata-rata berbobot indikator, dikonversi ke skala 0–100. */
function nilaiKomponen(ins: Indicator[], forms: Record<string, Partial<Assessment>>) {
  let sum = 0, tw = 0, terisi = 0;
  for (const i of ins) {
    const f = forms[i.id];
    if (!f || f.na || f.score === undefined) continue;
    const max = i.maxScore || 2;
    sum += (f.score / max) * 100 * (i.weight || 1);
    tw += i.weight || 1;
    terisi++;
  }
  return { nilai: tw ? Math.round((sum / tw) * 100) / 100 : 0, terisi, total: ins.length };
}

function badgeNilai(n: number) {
  if (n >= 75) return 'bg-emerald-600 text-white';
  if (n >= 50) return 'bg-amber-500 text-white';
  if (n > 0) return 'bg-red-500 text-white';
  return 'bg-slate-300 text-slate-700';
}

export function ComponentAccordion({ indicators, forms, locked, onScore, onOpenDetail }: Props) {
  const grup = useMemo(() => {
    const map = new Map<string, Indicator[]>();
    for (const i of indicators) {
      const k = i.subcomponent || 'Umum';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(i);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'id'));
  }, [indicators]);

  const ringkas = useMemo(() => nilaiKomponen(indicators, forms), [indicators, forms]);
  const semuaSub = useMemo(
    () => Object.fromEntries(grup.map(([k, ins]) => [k, nilaiKomponen(ins, forms)])),
    [grup, forms],
  );

  const [bukaInduk, setBukaInduk] = useState(true);
  const [bukaSub, setBukaSub] = useState<Record<string, boolean>>({});

  const subTerbuka = (k: string) => bukaSub[k] !== false; // default terbuka

  return (
    <div className="space-y-3">
      {/* ===== Kartu komponen ===== */}
      <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setBukaInduk(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-[#eef4fb] hover:bg-[#e4edf8] text-left"
        >
          {bukaInduk ? <ChevronDown size={18} className="text-[#173f70]" /> : <ChevronRight size={18} className="text-[#173f70]" />}
          <span className="font-bold text-[#173f70] flex-1">
            Komponen {indicators[0]?.component || ''}
          </span>
          <span className="text-xs text-slate-600">
            {ringkas.terisi}/{ringkas.total} ind
          </span>
          <span className={`text-sm font-bold px-3 py-1 rounded ${badgeNilai(ringkas.nilai)}`}>
            Nilai: {ringkas.nilai.toFixed(2)}
          </span>
        </button>

        {bukaInduk && (
          <div className="p-3 space-y-3 bg-white">
            {grup.map(([kode, ins]) => {
              const r = semuaSub[kode];
              const judul = ins[0]?.title || ins[0]?.description || kode;
              return (
                <div key={kode} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Sub-komponen */}
                  <button
                    type="button"
                    onClick={() => setBukaSub(s => ({ ...s, [kode]: !subTerbuka(kode) }))}
                    className="w-full flex items-center gap-3 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-left"
                  >
                    {subTerbuka(kode) ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                    <span className="font-semibold text-slate-700 text-sm flex-1">
                      {kode} — {judul}
                    </span>
                    <span className="text-xs text-slate-500">{r.terisi}/{r.total} ind</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${badgeNilai(r.nilai)}`}>
                      Nilai: {r.nilai.toFixed(2)}
                    </span>
                  </button>

                  {/* Indikator */}
                  {subTerbuka(kode) && (
                    <ul className="divide-y divide-slate-100">
                      {ins.map((i, n) => {
                        const f = forms[i.id] || {};
                        const isNA = !!f.na;
                        return (
                          <li key={i.id} className={`px-3 py-3 ${isNA ? 'bg-slate-100' : ''}`}>
                            <div className="flex items-start gap-3">
                              <span className="text-xs text-slate-400 w-5 pt-0.5">{n + 1}.</span>
                              <div className="flex-1">
                                <button
                                  type="button"
                                  disabled={locked}
                                  onClick={() => onOpenDetail(i)}
                                  className="text-left group"
                                >
                                  <span className={`text-sm font-medium ${isNA ? 'text-slate-400' : 'text-blue-600 group-hover:underline'}`}>
                                    {i.uraian || i.title || i.description}
                                  </span>
                                  <Search size={13} className="inline ml-1 text-slate-400" />
                                </button>
                                {isNA && (
                                  <span className="ml-2 text-xs bg-slate-300 text-slate-600 px-2 py-0.5 rounded-full">N/A</span>
                                )}

                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {SKALA.map(s => (
                                    <button
                                      key={s}
                                      type="button"
                                      disabled={locked || isNA}
                                      onClick={() =>
                                        onScore(
                                          i.id,
                                          s,
                                          f.notes && f.notes !== CATATAN_OTOMATIS[f.score ?? -1] ? f.notes : undefined,
                                          f.score,
                                        )
                                      }
                                      className={`w-9 h-9 rounded-lg border-2 font-bold text-sm transition ${
                                        f.score === s
                                          ? 'border-emerald-600 bg-emerald-600 text-white'
                                          : 'border-slate-300 text-slate-600 hover:border-emerald-400'
                                      } ${(locked || isNA) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() => onOpenDetail(i)}
                                    className="text-slate-400 hover:text-blue-600"
                                    title="Detail penggalian data"
                                  >
                                    <Info size={16} />
                                  </button>
                                  {f.notes && (
                                    <span className="text-xs text-slate-400 truncate max-w-[240px]" title={f.notes}>
                                      {f.notes}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
