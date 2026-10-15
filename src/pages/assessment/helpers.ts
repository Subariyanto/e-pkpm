import type { Assessment } from '../../types';

export const STEPS = [
  'Identitas dan Penugasan',
  'K1 — Penyusunan Program Pengawasan',
  'K2 — Pelaksanaan Program Pengawasan',
  'K3 — Evaluasi Hasil Pelaksanaan Program Pengawasan',
  'K4 — Pembimbingan dan Pelatihan Profesional',
];

export const COMP_KEYS = ['K1', 'K2', 'K3', 'K4'] as const;

export function emptyAssessment(pid: string, assessorId: string, indicatorId: string): Assessment {
  return {
    id: `${pid}-${indicatorId}`, supervisorId: pid, assessorId, periodId: '2026',
    indicatorId, documentName: '', documentNumber: '', documentDate: '', documentStatus: '',
    documentFound: false, dokumenDitemukan: {}, dokumenJumlah: 0, dokumenTotal: 0,
    aspekChecklist: [], aspekPercent: 0, recommendedScore: 0,
    score: undefined, na: false, naReason: '', notes: '', review: '', finding: '',
    recommendation: '', telaahDokumen: '', wawancara: '', konfirmasi: '', konsistensi: '',
    rtlMasalah: '', rtlAkarMasalah: '', rtlTindakan: '', rtlProduk: '', rtlBentukPKB: '',
    rtlTarget: '', rtlPIC: '', rtlBukti: '', rtlStatus: '', updatedAt: new Date().toISOString(),
  };
}
