import { describe, expect, it } from 'vitest';
import { indicators } from './demo';
import { indicatorsV2, RHK_MAP } from './instruments-v2';
import { regulasiData } from './demo';

describe('integrasi indikator KBC PKPM 2026', () => {
  const expected = ['K1.KBC', 'K2.KBC', 'K3.KBC', 'K4.KBC'];

  it('memuat empat indikator KBC pada empat komponen di data baku dan data demo', () => {
    for (const code of expected) {
      const standard = indicatorsV2.find(item => item.code === code);
      const demo = indicators.find(item => item.code === code);
      expect(standard?.component).toBe(code.slice(0, 2));
      expect(demo?.component).toBe(code.slice(0, 2));
      expect(standard?.docSpecs?.length).toBeGreaterThan(0);
      expect(standard?.aspek.length).toBeGreaterThan(0);
    }
  });

  it('memetakan bukti dukung RHK dan dasar hukum Kepdirjen 6077 Tahun 2025', () => {
    for (const code of expected) expect(RHK_MAP[code]?.length).toBeGreaterThan(0);
    expect(regulasiData.some(item => item.nomor?.includes('6077 Tahun 2025') && item.tahun === 2025)).toBe(true);
  });
});
