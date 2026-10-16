/**
 * Perhitungan Prioritas PKB Kabupaten.
 *
 * Satu-satunya sumber data untuk halaman Rekap & PKB, halaman Cetak Prioritas
 * PKB, dan ekspor Excel/Laporan. Jangan duplikasi logika ini di komponen lain.
 *
 * Butir instrumen baku dibuat dua kali: `indicatorsV2` memakai field `version`
 * dan id berawalan `v2-`, sedangkan `newIndicators` (data demo) memakai
 * `versiInstrumen`. Karena itu penyaring versi dibuat toleran.
 */
import type { Assessment, Indicator } from '../types';

export interface PrioritasPkb {
  indikator: Indicator;
  /** Skor yang sudah terisi (butir N/A tidak dihitung). */
  nilai: number[];
  jumlahDinilai: number;
  /** Rata-rata skor seluruh pengawas yang dinilai. */
  rataRata: number;
  /** Jumlah pengawas dengan skor 0 atau 1. */
  jumlahLemah: number;
  /** Persentase capaian terhadap skor maksimal (0-100). */
  capaianPersen: number;
  peringkat: number;
}

/** Benar bila butir berasal dari instrumen baku versi PKPM 0-2 v2. */
export function butirBakuV2(i: Indicator): boolean {
  return (
    i.versiInstrumen === 'pkpm-0-2-v2' ||
    i.version === 'pkpm-0-2-v2' ||
    (i.id || '').startsWith('v2-')
  );
}

/**
 * Hitung prioritas PKB: butir instrumen baku yang sudah dinilai, diurutkan
 * dari rata-rata skor terendah (paling perlu dikembangkan).
 */
export function hitungPrioritasPkb(
  asms: Assessment[],
  ins: Indicator[],
  batas = 5,
): PrioritasPkb[] {
  return ins
    .filter(butirBakuV2)
    .map((indikator) => {
      const nilai = asms
        .filter((a) => a.indicatorId === indikator.id && !a.na)
        .map((a) => a.score ?? 0);
      const total = nilai.reduce((a, b) => a + b, 0);
      const rataRata = nilai.length ? total / nilai.length : 0;
      const maxScore = indikator.maxScore || 2;
      return {
        indikator,
        nilai,
        jumlahDinilai: nilai.length,
        rataRata,
        jumlahLemah: nilai.filter((v) => v <= 1).length,
        capaianPersen: nilai.length ? (rataRata / maxScore) * 100 : 0,
        peringkat: 0,
      };
    })
    .filter((x) => x.nilai.length > 0)
    .sort((a, b) => a.rataRata - b.rataRata || a.indikator.code.localeCompare(b.indikator.code))
    .slice(0, batas)
    .map((x, n) => ({ ...x, peringkat: n + 1 }));
}
