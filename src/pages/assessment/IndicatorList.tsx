import { useMemo } from 'react';
import type { Assessment, Indicator } from '../../types';
import { CATATAN_OTOMATIS } from '../../data/demo';
import { Info } from 'lucide-react';

/**
 * Daftar indikator gaya ringkas (mengikuti pola PKG).
 * Satu indikator = satu baris:
 *   K1.1 — Program Pengawasan Tahunan   [0] [1] [2]  [Catatan]
 * Skor hanya ditampilkan per komponen (di header), bukan per indikator.
 */
const SKALA = [0, 1, 2] as const;

type Rhk = { no: number; tw: string; nama: string };

type Props = {
  indicators: Indicator[];
  forms: Record<string, Partial<Assessment>>;
  locked: boolean;
  onScore: (id: string, score: 0 | 1 | 2, noteLama?: string, skorLama?: number) => void;
  onOpenDetail: (i: Indicator) => void;
  /** Pemetaan kode indikator → RHK e-RHK sebagai bukti dukung. */
  rhkOf?: (code?: string) => Rhk[] | undefined;
};

/** Nilai komponen: rata-rata berbobot indikator, dikonversi ke skala 0–100. */
export function nilaiKomponen(ins: Indicator[], forms: Record<string, Partial<Assessment>>) {
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

export function badgeNilai(n: number) {
  if (n >= 75) return 'bg-emerald-600 text-white';
  if (n >= 50) return 'bg-amber-500 text-white';
  if (n > 0) return 'bg-red-500 text-white';
  return 'bg-slate-300 text-slate-700';
}

export function IndicatorList({ indicators, forms, locked, onScore, onOpenDetail, rhkOf }: Props) {
  const urut = useMemo(
    () => [...indicators].sort((a, b) => (a.code || '').localeCompare(b.code || '', 'id')),
    [indicators],
  );
  const ringkas = useMemo(() => nilaiKomponen(indicators, forms), [indicators, forms]);

  return (
    <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* ===== Header komponen + nilai komponen (satu-satunya tempat nilai muncul) ===== */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#eef4fb]">
        <span className="font-bold text-[#173f70] flex-1">
          Komponen {indicators[0]?.component || ''}
        </span>
        <span className="text-xs text-slate-600">{ringkas.terisi}/{ringkas.total} ind</span>
        <span className={`text-sm font-bold px-3 py-1 rounded ${badgeNilai(ringkas.nilai)}`}>
          Nilai: {ringkas.nilai.toFixed(2)}
        </span>
      </div>

      {/* ===== Satu baris per indikator ===== */}
      <ul className="divide-y divide-slate-100">
        {urut.map(i => {
          const f = forms[i.id] || {};
          const isNA = !!f.na;
          const label = `${i.code || ''}${i.code ? ' — ' : ''}${i.uraian || i.title || i.description || ''}`;
          return (
            <li key={i.id} className={`px-3 py-3 md:px-4 ${isNA ? 'bg-slate-100' : ''}`}>
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                <button
                  type="button"
                  onClick={() => onOpenDetail(i)}
                  className="flex-1 text-left group min-w-0"
                  title="Buka detail penggalian data"
                >
                  <span className={`text-sm font-semibold ${isNA ? 'text-slate-400' : 'text-[#173f70] group-hover:text-blue-700'}`}>
                    {label}
                  </span>
                  <Info size={14} className="inline ml-1.5 text-slate-400 group-hover:text-blue-600" />
                  {isNA && (
                    <span className="ml-2 text-xs bg-slate-300 text-slate-600 px-2 py-0.5 rounded-full">N/A</span>
                  )}

                  {/* Keterangan kecil: RHK e-RHK sebagai bukti dukung */}
                  {(() => {
                    const rhk = rhkOf?.(i.code);
                    if (!rhk || !rhk.length) return null;
                    return (
                      <span className="block text-[11px] text-slate-500 mt-1 leading-snug">
                        <span className="font-semibold text-slate-600">Bukti Dukung:</span>{' '}
                        {rhk.map((r, n) => (
                          <span key={r.no}>
                            {n > 0 && <span className="text-slate-400"> · </span>}
                            <span className="font-medium text-blue-700">RHK-{r.no}</span>
                            <span className="text-slate-400"> ({r.tw}) </span>
                            {r.nama}
                          </span>
                        ))}
                      </span>
                    );
                  })()}
                </button>

                <div className="flex items-center gap-2 shrink-0">
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
                </div>

                {/* Catatan: ringkas + bisa diklik untuk membuka detail penuh */}
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onOpenDetail(i)}
                  className="text-xs text-left md:w-[220px] shrink-0 text-slate-400 hover:text-blue-600 truncate"
                  title={f.notes || 'Belum ada catatan — klik untuk mengisi'}
                >
                  {f.notes ? f.notes : <span className="italic">Catatan…</span>}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
