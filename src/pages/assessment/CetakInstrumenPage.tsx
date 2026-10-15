/**
 * Cetak Instrumen PKPM — dokumen resmi yang bisa dicetak (A4).
 *
 * Struktur:
 *   1. Kop + identitas pengawas yang dinilai & penilai
 *   2. Tabel butir instrumen per komponen (K1–K4) + skor
 *   3. Catatan Hasil Penilaian   — terisi otomatis dari skor
 *   4. Rencana Tindak Lanjut     — terisi otomatis dari skor
 *   5. Rekap nilai per komponen + Nilai Akhir & predikat
 *   6. Tanda tangan sejajar: kiri Pengawas yang Dinilai, kanan Penilai
 */
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { Button, Card, PageTitle, TABLE_CELL } from '../../components/Layout';
import { calculate, indicatorsForJenjang, instrumenAktif } from '../../services/core';
import { AUTO_ISI } from '../../data/demo';
import { emptyAssessment, COMP_KEYS } from './helpers';
import { nilaiKomponen } from './IndicatorList';
import type { Assessment, Indicator } from '../../types';
import { Printer } from 'lucide-react';

type Profil = { nama?: string; nip?: string; jabatan?: string; unit?: string; kabupaten?: string; kop?: string[] };
type Org = { name?: string; district?: string; chairman?: string; period?: string; address?: string; phone?: string; email?: string };

/** Ringkasan Catatan Hasil Penilaian dari skor seluruh indikator. */
function catatanHasil(rows: { ind: Indicator; a?: Partial<Assessment> }[]) {
  const dinilai = rows.filter(r => r.a && !r.a.na && r.a.score !== undefined);
  const na = rows.filter(r => r.a?.na);
  const rendah = dinilai.filter(r => (r.a!.score as number) <= 1);
  const tinggi = dinilai.filter(r => (r.a!.score as number) === 2);

  const p: string[] = [];
  p.push(
    `Dari ${rows.length} butir instrumen, ${dinilai.length} butir telah dinilai dan ${na.length} butir dinyatakan tidak berlaku (N/A) sesuai jenjang jabatan maupun penugasan pengawas.`,
  );
  if (tinggi.length) {
    p.push(
      `Sebanyak ${tinggi.length} butir memperoleh skor 2 (terlaksana lengkap dan sesuai), yaitu: ${tinggi
        .map(r => r.ind.code)
        .join(', ')}.`,
    );
  }
  if (rendah.length) {
    p.push(
      `Sebanyak ${rendah.length} butir memperoleh skor 0–1 sehingga memerlukan perbaikan, yaitu: ${rendah
        .map(r => `${r.ind.code} (skor ${r.a!.score})`)
        .join(', ')}.`,
    );
  } else if (dinilai.length) {
    p.push('Tidak ditemukan butir dengan skor 0–1; seluruh kegiatan terlaksana lengkap dan sesuai.');
  }
  if (na.length) {
    p.push(`Butir N/A: ${na.map(r => r.ind.code).join(', ')}.`);
  }
  return p;
}

/** Ringkasan Rencana Tindak Lanjut dari skor seluruh indikator. */
function rekapRTL(rows: { ind: Indicator; a?: Partial<Assessment> }[]) {
  const items = rows
    .filter(r => r.a && !r.a.na && r.a.score !== undefined && (r.a.score as number) <= 1)
    .sort((x, y) => (x.a!.score as number) - (y.a!.score as number));
  return items.map(r => {
    const auto = AUTO_ISI[r.a!.score as number];
    return {
      code: r.ind.code,
      title: r.ind.title || r.ind.description || '',
      score: r.a!.score as number,
      masalah: r.a!.rtlMasalah || (auto ? auto.rtlMasalah : '') || '-',
      tindakan: r.a!.rtlTindakan || (auto ? auto.rtlTindakan : '') || '-',
      produk: r.a!.rtlProduk || (auto ? auto.rtlProduk : '') || '-',
      bentukPKB: r.a!.rtlBentukPKB || (auto ? auto.rtlBentukPKB : '') || '-',
      status: r.a!.rtlStatus || (auto ? auto.rtlStatus : '') || '-',
    };
  });
}

export function CetakInstrumenPage() {
  const ps = useLiveQuery(() => db.supervisors.toArray(), []) || [];
  const allIns = useLiveQuery(() => db.indicators.orderBy('order').toArray(), []) || [];
  const profilSetting = useLiveQuery(() => db.settings.get('profilPenilai'), []);
  const orgSetting = useLiveQuery(() => db.org.toCollection().first(), []);

  const [pid, setPid] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [skNumber, setSkNumber] = useState('');
  const [skDate, setSkDate] = useState('');

  const supervisor = ps.find(x => x.id === pid);
  const jenjang = (supervisor?.level || 'Madya') as 'Muda' | 'Madya' | 'Utama';

  const ins = useMemo(
    () => indicatorsForJenjang(instrumenAktif(allIns), jenjang),
    [allIns, jenjang],
  );

  const rows = useLiveQuery(
    () => (pid ? db.assessments.where('supervisorId').equals(pid).toArray() : Promise.resolve([] as Assessment[])),
    [pid],
  ) || [];

  // Ambil otomatis nomor/tanggal SK yang sudah tersimpan pada penilaian.
  useEffect(() => {
    if (!pid) return;
    setHydrated(false);
    db.results.get(`2026-${pid}`).then(r => {
      setSkNumber((r?.skNumber || r?.skPenugasan || '') as string);
      setSkDate((r?.skDate || r?.tanggalSk || '') as string);
      setHydrated(true);
    });
  }, [pid]);

  const peta = useMemo(() => Object.fromEntries(rows.map(r => [r.indicatorId, r])), [rows]);

  /** Baris instrumen lengkap dengan hasil hitung (skor kosong → 0 untuk perhitungan). */
  const baris = useMemo(
    () => ins.map(i => ({ ind: i, a: peta[i.id] })),
    [ins, peta],
  );

  const hitung = useMemo(() => {
    const full: Assessment[] = ins.map(i => {
      const base = emptyAssessment(pid || 'x', supervisor?.assessorId || 'u1', i.id);
      return { ...base, ...(peta[i.id] || {}), indicatorId: i.id } as Assessment;
    });
    return calculate(full, ins);
  }, [ins, peta, pid, supervisor?.assessorId]);

  const dinilai = baris.filter(r => r.a && !r.a.na && r.a.score !== undefined);
  const belum = baris.length - dinilai.length;
  const catatan = useMemo(() => catatanHasil(baris), [baris]);
  const rtl = useMemo(() => rekapRTL(baris), [baris]);
  const profil = (profilSetting?.value || {}) as Profil;
  const org = (orgSetting || {}) as Org;
  const kabupaten = (profil.kabupaten || '').trim();
  const kotaTtd = kabupaten || org.district || 'Jember';

  /**
   * Kop surat empat baris yang dipakai pada lembar cetak.
   * Diambil dari isian menu Profil Penilai & Sasaran; baris yang dikosongkan
   * memakai teks bawaan supaya dokumen tetap utuh.
   */
  const kopBawaan = [
    'KEMENTERIAN AGAMA REPUBLIK INDONESIA',
    `KANTOR KEMENTERIAN AGAMA${kabupaten ? ` KABUPATEN ${kabupaten.toUpperCase()}` : ''}`,
    org.address || '',
    [org.phone ? `Telepon ${org.phone}` : '', org.email || ''].filter(Boolean).join(' · '),
  ];
  const kop = [0, 1, 2, 3].map(i => (profil.kop?.[i] || '').trim() || kopBawaan[i]).filter(Boolean);

  const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      {/* ===== Panel kontrol (tidak ikut tercetak) ===== */}
      <div className="print:hidden">
        <PageTitle
          title="Cetak Instrumen"
          desc="Dokumen instrumen penilaian siap cetak — lengkap dengan catatan hasil, rencana tindak lanjut, dan kolom tanda tangan"
          action={<Button onClick={() => window.print()} disabled={!pid}><Printer size={16} className="inline" /> Cetak / Simpan PDF</Button>}
        />

        <Card>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="text-sm md:col-span-1">Pengawas yang dinilai
              <select className="input mt-1" value={pid} onChange={e => setPid(e.target.value)}>
                <option value="">Pilih pengawas</option>
                {ps.map(p => <option key={p.id} value={p.id}>{p.name} — {p.level}</option>)}
              </select>
            </label>
            <label className="text-sm">Nomor SK / Surat Tugas
              <input className="input mt-1" value={skNumber} onChange={e => setSkNumber(e.target.value)} placeholder="Nomor SK penugasan" />
            </label>
            <label className="text-sm">Tanggal SK
              <input className="input mt-1" value={skDate} onChange={e => setSkDate(e.target.value)} placeholder="Tanggal SK" />
            </label>
          </div>
          {pid && (
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
              <span>Butir dinilai: <b>{dinilai.length}</b> dari <b>{baris.length}</b></span>
              <span>Belum diberi skor: <b>{belum}</b></span>
              <span>Nilai akhir: <b>{hitung.final.toFixed(2)}</b> ({hitung.predicate})</span>
              {!hydrated && <span className="text-amber-700">Memuat data SK…</span>}
            </div>
          )}
          {pid && belum > 0 && (
            <p className="text-xs text-amber-700 mt-2">
              Perhatian: {belum} butir belum diberi skor — pada lembar cetak ditampilkan sebagai “belum dinilai”.
            </p>
          )}
        </Card>

        <p className="text-xs text-slate-500 mt-3">
          Gunakan pilihan “Simpan sebagai PDF” pada dialog cetak. Ukuran kertas A4, margin default.
        </p>
      </div>

      {/* ===== Lembar cetak ===== */}
      {pid && (
        <div id="cetak-instrumen" className="print-area bg-white text-slate-900 mt-6 print:mt-0">
          {/* Kop — empat baris dari menu Profil Penilai & Sasaran */}
          <div className="text-center border-b-4 border-double border-slate-800 pb-3 mb-4">
            {kop.map((baris, i) => (
              <p
                key={i}
                className={
                  i === 0 ? 'text-sm font-semibold uppercase tracking-wide'
                    : i === 1 ? 'text-lg font-bold uppercase'
                      : 'text-[11px] text-slate-600'
                }
              >
                {baris}
              </p>
            ))}
          </div>

          <h1 className="text-center font-bold text-base uppercase">Instrumen Penilaian Kinerja Pengawas Madrasah</h1>
          <p className="text-center text-xs mb-4">
            (PKPM) — Periode {org.period || '2026'} · Jenjang Jabatan {jenjang}
          </p>

          {/* Identitas + penilai (tabel, bukan grid — aman saat dicetak) */}
          <table className="w-full text-xs border-collapse mb-4">
            <tbody>
              <tr>
                <td className={`${TABLE_CELL} w-1/4 font-semibold`}>Nama Pengawas</td>
                <td className={`${TABLE_CELL} w-1/4`}>{supervisor?.name || '-'}</td>
                <td className={`${TABLE_CELL} w-1/4 font-semibold`}>Nama Penilai</td>
                <td className={`${TABLE_CELL} w-1/4`}>{profil.nama || '-'}</td>
              </tr>
              <tr>
                <td className={`${TABLE_CELL} font-semibold`}>NIP</td>
                <td className={TABLE_CELL}>{supervisor?.nip || '-'}</td>
                <td className={`${TABLE_CELL} font-semibold`}>NIP</td>
                <td className={TABLE_CELL}>{profil.nip || '-'}</td>
              </tr>
              <tr>
                <td className={`${TABLE_CELL} font-semibold`}>Pangkat/Golongan</td>
                <td className={TABLE_CELL}>{supervisor?.rank || '-'}</td>
                <td className={`${TABLE_CELL} font-semibold`}>Jabatan</td>
                <td className={TABLE_CELL}>{profil.jabatan || '-'}</td>
              </tr>
              <tr>
                <td className={`${TABLE_CELL} font-semibold`}>Satuan Kerja</td>
                <td className={TABLE_CELL}>{supervisor?.workUnit || '-'}</td>
                <td className={`${TABLE_CELL} font-semibold`}>Unit Kerja</td>
                <td className={TABLE_CELL}>{profil.unit || '-'}</td>
              </tr>
              <tr>
                <td className={`${TABLE_CELL} font-semibold`}>Wilayah Binaan</td>
                <td className={TABLE_CELL}>{supervisor?.region || '-'}</td>
                <td className={`${TABLE_CELL} font-semibold`}>No. SK / Surat Tugas</td>
                <td className={TABLE_CELL}>{skNumber || '-'}{skDate ? ` · ${skDate}` : ''}</td>
              </tr>
            </tbody>
          </table>

          {/* Butir instrumen per komponen */}
          {COMP_KEYS.map(k => {
            const compIns = baris.filter(r => r.ind.component === k);
            if (!compIns.length) return null;
            const ringkas = nilaiKomponen(compIns.map(r => r.ind), peta);
            return (
              <div key={k} className="mb-4 avoid-break">
                <div className="flex items-center justify-between bg-slate-200 px-2 py-1 border border-slate-400">
                  <b className="text-xs uppercase">Komponen {k}</b>
                  <span className="text-xs">Nilai Komponen: <b>{ringkas.nilai.toFixed(2)}</b> · {ringkas.terisi}/{ringkas.total} butir</span>
                </div>
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-400 px-2 py-1 w-10">No</th>
                      <th className="border border-slate-400 px-2 py-1 text-left">Butir Instrumen</th>
                      <th className="border border-slate-400 px-2 py-1 w-14">Skor</th>
                      <th className="border border-slate-400 px-2 py-1 text-left w-2/5">Catatan / Temuan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compIns.map((r, n) => {
                      const a = r.a;
                      const na = !!a?.na;
                      const skorTeks = !a || na ? (na ? 'N/A' : '—') : a.score === undefined ? 'belum dinilai' : String(a.score);
                      return (
                        <tr key={r.ind.id}>
                          <td className={`${TABLE_CELL} text-center`}>{n + 1}</td>
                          <td className={TABLE_CELL}>
                            <b>{r.ind.code}</b> — {r.ind.title || r.ind.description}
                          </td>
                          <td className={`${TABLE_CELL} text-center font-semibold`}>{skorTeks}</td>
                          <td className={TABLE_CELL}>
                            {na ? (a?.naReason || 'Tidak berlaku') : a?.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* C. Catatan Hasil Penilaian */}
          <div className="mb-4 avoid-break">
            <p className="font-bold text-xs uppercase mb-1">Catatan Hasil Penilaian</p>
            <div className="border border-slate-400 p-2 text-[11px] leading-relaxed">
              {catatan.map((t, i) => <p key={i} className="mb-1">{t}</p>)}
              <p className="mt-2">
                Nilai akhir <b>{hitung.final.toFixed(2)}</b> dengan predikat <b>{hitung.predicate}</b>
                {Object.keys(hitung.components).length
                  ? ` (K1: ${hitung.components.K1?.toFixed(2)}, K2: ${hitung.components.K2?.toFixed(2)}, K3: ${hitung.components.K3?.toFixed(2)}, K4: ${hitung.components.K4?.toFixed(2)})`
                  : ''}
                . <i>Catatan ini terisi otomatis berdasarkan skor hasil penilaian dan dapat disesuaikan oleh penilai.</i>
              </p>
            </div>
          </div>

          {/* D. Rencana Tindak Lanjut */}
          <div className="mb-4 avoid-break">
            <p className="font-bold text-xs uppercase mb-1">Rencana Tindak Lanjut</p>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 px-2 py-1 w-24">Kode</th>
                  <th className="border border-slate-400 px-2 py-1 w-14">Skor</th>
                  <th className="border border-slate-400 px-2 py-1 text-left">Masalah / Kesenjangan</th>
                  <th className="border border-slate-400 px-2 py-1 text-left">Tindakan Perbaikan & Produk</th>
                  <th className="border border-slate-400 px-2 py-1 w-28">Bentuk PKB</th>
                  <th className="border border-slate-400 px-2 py-1 w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {rtl.length ? rtl.map(x => (
                  <tr key={x.code}>
                    <td className={TABLE_CELL}>{x.code}</td>
                    <td className={`${TABLE_CELL} text-center font-semibold`}>{x.score}</td>
                    <td className={TABLE_CELL}>{x.masalah}</td>
                    <td className={TABLE_CELL}>{x.tindakan}<br /><span className="text-slate-600">Produk: {x.produk}</span></td>
                    <td className={TABLE_CELL}>{x.bentukPKB}</td>
                    <td className={TABLE_CELL}>{x.status}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className={`${TABLE_CELL} text-center`} colSpan={6}>
                      Tidak ada butir berskor 0–1. Rencana tindak lanjut difokuskan pada pemeliharaan dan penguatan mutu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* E. Rekap Nilai */}
          <div className="mb-6 avoid-break">
            <p className="font-bold text-xs uppercase mb-1">Rekapitulasi Nilai</p>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 px-2 py-1">Komponen</th>
                  <th className="border border-slate-400 px-2 py-1 w-24">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {COMP_KEYS.map(k => (
                  <tr key={k}>
                    <td className={TABLE_CELL}>Komponen {k}</td>
                    <td className={`${TABLE_CELL} text-center`}>{(hitung.components[k] || 0).toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-100">
                  <td className={`${TABLE_CELL} font-bold`}>Nilai Akhir</td>
                  <td className={`${TABLE_CELL} text-center font-bold`}>{hitung.final.toFixed(2)} ({hitung.predicate})</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* F. Tanda tangan sejajar */}
          <div className="avoid-break">
            <p className="text-right text-xs mb-1">{kotaTtd}, {tanggalCetak}</p>
            <table className="w-full text-xs">
              <tbody>
                <tr>
                  <td className="w-1/2 text-center align-top">
                    <p>Pengawas yang Dinilai,</p>
                    <div className="h-24" />
                    <p className="font-semibold underline">{supervisor?.name || '________________________'}</p>
                    <p>NIP. {supervisor?.nip || '____________________'}</p>
                  </td>
                  <td className="w-1/2 text-center align-top">
                    <p>Penilai,</p>
                    <div className="h-24" />
                    <p className="font-semibold underline">{profil.nama || '________________________'}</p>
                    <p>NIP. {profil.nip || '____________________'}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
