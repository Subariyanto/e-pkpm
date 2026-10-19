/**
 * Profil Penilai — Opsi A (data lokal per perangkat).
 *
 * Penilai mengisi sendiri identitas dirinya di perangkat masing-masing,
 * lalu mengisi daftar Pengawas yang menjadi sasarannya. Tidak ada
 * pembagian dari pusat: pembagian cukup dibagikan lewat surat/chat,
 * petugas menuliskannya di sini.
 *
 * Hasil akhir tetap digabung oleh Ketua Pokjawas lewat menu "Gabung Data".
 */
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, audit } from '../lib/db';
import { Button, Card, PageTitle, IconButton } from '../components/Layout';
import { emptyAssessment } from './assessment/helpers';
import type { Supervisor } from '../types';
import { UserRound, Plus, Trash2, AlertTriangle, Pencil, Save, X } from 'lucide-react';

/** Data form sasaran (pengawas yang dinilai). */
type SasaranForm = {
  name: string; nip: string; position: string; rank: string;
  level: string; workUnit: string; region: string; phone: string; email: string;
};
const FORM_KOSONG: SasaranForm = {
  name: '', nip: '', position: 'Pengawas Madrasah', rank: '',
  level: 'Madya', workUnit: 'Kantor Kementerian Agama Kab. Jember', region: '', phone: '', email: '',
};

/** Tabel ringkas tanpa mengimpor helper halaman lain. */
const Table = ({ heads, rows }: { heads: string[]; rows: React.ReactNode[][] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-100">
          {heads.map(h => <th key={h} className="p-3 text-left whitespace-nowrap">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b">
            {r.map((x, j) => <td key={j} className="p-3 whitespace-nowrap">{x}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export function MyProfilePage() {
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [unit, setUnit] = useState('');
  const [kabupaten, setKabupaten] = useState('');
  const [kop1, setKop1] = useState('');
  const [kop2, setKop2] = useState('');
  const [kop3, setKop3] = useState('');
  const [kop4, setKop4] = useState('');
  const [info, setInfo] = useState('');
  const [ketuaPokjawas, setKetuaPokjawas] = useState('');
  const [nipKetua, setNipKetua] = useState('');
  const [kepalaKantor, setKepalaKantor] = useState('');
  const [nipKantor, setNipKantor] = useState('');
  const [form, setForm] = useState<SasaranForm | null>(null);
  const [formId, setFormId] = useState<string | null>(null); // null = mode tambah
  const [formErr, setFormErr] = useState('');
  // Pesan khusus kartu Identitas Penilai & Pejabat. Sebelumnya semua pesan
  // memakai satu state `info` yang dirender di kartu Sasaran — jauh di bawah
  // tombol Simpan — sehingga kegagalan validasi tampak seperti tombol mati.
  const [profilErr, setProfilErr] = useState('');
  const [profilOk, setProfilOk] = useState('');
  const [pejabatErr, setPejabatErr] = useState('');
  const [pejabatOk, setPejabatOk] = useState('');

  const profil = useLiveQuery(() => db.settings.get('profilPenilai'), []);
  const orgRow = useLiveQuery(() => db.org.toCollection().first(), []);
  const p = profil?.value as {
    nama?: string; nip?: string; jabatan?: string; unit?: string;
    kabupaten?: string; kop?: string[];
  } | undefined;

  const ps = useLiveQuery(() => db.supervisors.toArray(), []) || [];
  const aku = useMemo(() => ps.find(x => x.nip === p?.nip), [ps, p?.nip]);

  /*
   * Isi kolom dengan nilai yang sudah tersimpan.
   * Sebelumnya kolom dibiarkan kosong dan hanya memakai placeholder abu-abu.
   * Di ponsel placeholder mudah disangka isian sungguhan, sehingga pengguna
   * mengira datanya hilang setiap kali berpindah menu. Nilai yang sedang
   * diketik tidak pernah ditimpa karena hanya diisi bila kolom masih kosong.
   */
  useEffect(() => {
    if (!p) return;
    setNama(v => v || p.nama || '');
    setNip(v => v || p.nip || '');
    setJabatan(v => v || p.jabatan || '');
    setUnit(v => v || p.unit || '');
    setKabupaten(v => v || p.kabupaten || '');
    const kop = p.kop || [];
    setKop1(v => v || kop[0] || '');
    setKop2(v => v || kop[1] || '');
    setKop3(v => v || kop[2] || '');
    setKop4(v => v || kop[3] || '');
  }, [p]);

  useEffect(() => {
    if (!orgRow) return;
    setKetuaPokjawas(v => v || orgRow.chairman || '');
    setKepalaKantor(v => v || orgRow.headOffice || '');
    setNipKetua(v => v || (orgRow as any).nipChairman || '');
    setNipKantor(v => v || (orgRow as any).nipHeadOffice || '');
  }, [orgRow]);

  async function simpanProfil() {
    setProfilErr(''); setProfilOk('');
    const n = (nama || p?.nama || '').trim();
    const pin = (nip || p?.nip || '').replace(/\D/g, '');
    const j = (jabatan || p?.jabatan || '').trim();
    const u = (unit || p?.unit || '').trim();
    const kab = (kabupaten || p?.kabupaten || '').trim();
    const kopLama = p?.kop || [];
    const kopBaru = [
      (kop1 || kopLama[0] || '').trim(),
      (kop2 || kopLama[1] || '').trim(),
      (kop3 || kopLama[2] || '').trim(),
      (kop4 || kopLama[3] || '').trim(),
    ];
    if (!n) return setProfilErr('Nama penilai wajib diisi.');
    if (pin && !/^\d{18}$/.test(pin)) {
      return setProfilErr(`NIP harus tepat 18 angka — yang terbaca ${pin.length} angka. Boleh dikosongkan.`);
    }
    try {
      if (pin) {
        const bentrok = await db.supervisors.where('nip').equals(pin).first();
        if (bentrok && bentrok.name !== n) {
          return setProfilErr(`NIP ${pin} sudah dipakai pengawas "${bentrok.name}". Periksa kembali.`);
        }
      }
      await db.settings.put({
        key: 'profilPenilai',
        value: { nama: n, nip: pin, jabatan: j, unit: u, kabupaten: kab, kop: kopBaru },
      });
      await audit('PROFIL_PENILAI', n, { nip: pin, kabupaten: kab });
      // Kolom sengaja tidak dikosongkan agar pengguna melihat data yang tersimpan.
      setNama(n); setNip(pin); setJabatan(j); setUnit(u); setKabupaten(kab);
      setKop1(kopBaru[0]); setKop2(kopBaru[1]); setKop3(kopBaru[2]); setKop4(kopBaru[3]);
      setProfilOk('Profil penilai dan kop surat tersimpan di perangkat ini.');
    } catch (e: any) {
      // Tanpa penanganan galat, kegagalan tulis membuat tombol tampak mati.
      setProfilErr('Gagal menyimpan: ' + (e?.message || String(e)));
    }
  }

  /** Simpan data pejabat penandatangan ke tabel org (dibuat bila belum ada). */
  async function simpanPejabat() {
    setPejabatErr(''); setPejabatOk('');
    const ketua = (ketuaPokjawas || orgRow?.chairman || '').trim();
    const kantor = (kepalaKantor || orgRow?.headOffice || '').trim();
    const nipK = (nipKetua || (orgRow as any)?.nipChairman || '').replace(/\D/g, '');
    const nipKn = (nipKantor || (orgRow as any)?.nipHeadOffice || '').replace(/\D/g, '');
    if (!ketua && !kantor) return setPejabatErr('Isi minimal salah satu nama pejabat penandatangan.');
    if (nipK && !/^\d{18}$/.test(nipK)) {
      return setPejabatErr(`NIP Ketua Pokjawas harus tepat 18 angka — yang terbaca ${nipK.length} angka.`);
    }
    if (nipKn && !/^\d{18}$/.test(nipKn)) {
      return setPejabatErr(`NIP Kepala Kantor harus tepat 18 angka — yang terbaca ${nipKn.length} angka.`);
    }
    try {
      if (orgRow) {
        await db.org.update(orgRow.id, {
          chairman: ketua, headOffice: kantor,
          nipChairman: nipK, nipHeadOffice: nipKn,
        } as any);
      } else {
        // Perangkat ini belum punya baris organisasi — buat baru agar data pejabat
        // tidak hilang. Nilai identitas lain memakai bawaan yang aman.
        await db.org.add({
          id: 'ORG-JEMBER', name: 'Pokjawas Madrasah Kabupaten Jember',
          district: 'Kabupaten Jember', province: 'Jawa Timur',
          chairman: ketua, headOffice: kantor,
          address: '', phone: '', email: '', period: '2026',
          nipChairman: nipK, nipHeadOffice: nipKn,
        } as any);
      }
      await audit('PEJABAT_TTD', 'Penandatangan', { ketua, kantor });
      setKetuaPokjawas(ketua); setNipKetua(nipK); setKepalaKantor(kantor); setNipKantor(nipKn);
      setPejabatOk('Nama dan NIP pejabat penandatangan tersimpan.');
    } catch (e: any) {
      setPejabatErr('Gagal menyimpan: ' + (e?.message || String(e)));
    }
  }

  /** Buka form tambah sasaran (kosong). */
  function tambahSasaran() {
    setFormId(null);
    setForm({ ...FORM_KOSONG });
    setFormErr('');
    setInfo('');
  }

  /** Buka form ubah sasaran (terisi data yang ada). */
  function ubahSasaran(x: Supervisor) {
    setFormId(x.id);
    setForm({
      name: x.name || '', nip: x.nip || '', position: x.position || 'Pengawas Madrasah',
      rank: x.rank || '', level: x.level || 'Madya', workUnit: x.workUnit || '',
      region: x.region || '', phone: x.phone || '', email: x.email || '',
    });
    setFormErr('');
    setInfo('');
  }

  function tutupForm() {
    setForm(null);
    setFormId(null);
    setFormErr('');
  }

  /** Simpan sasaran dari form (tambah atau ubah). */
  async function simpanSasaran() {
    if (!form) return;
    const name = form.name.trim();
    const nip = form.nip.trim();
    if (!name) return setFormErr('Nama pengawas wajib diisi.');
    if (!/^\d{18}$/.test(nip)) return setFormErr('NIP wajib 18 digit angka.');
    if (p?.nip && nip === p.nip) return setFormErr('Penilai tidak boleh menilai dirinya sendiri.');
    const bentrok = await db.supervisors.where('nip').equals(nip).first();
    if (bentrok && bentrok.id !== formId) {
      return setFormErr(`NIP ${nip} sudah dipakai sasaran "${bentrok.name}".`);
    }

    const isi = {
      name, nip,
      position: form.position.trim() || 'Pengawas Madrasah',
      rank: form.rank.trim(),
      level: form.level as Supervisor['level'],
      workUnit: form.workUnit.trim(),
      region: form.region.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
    };

    if (formId) {
      const lama = await db.supervisors.get(formId);
      await db.supervisors.update(formId, isi);
      await audit('UBAH', 'Sasaran (Profil Penilai)', isi, lama);
      setInfo(`Data sasaran "${name}" diperbarui.`);
    } else {
      const s: Supervisor = {
        id: crypto.randomUUID(), ...isi,
        schools: 0, principals: 0, teachers: 0, active: true,
        assessorId: p?.nip || p?.nama || 'penilai-lokal',
      };
      await db.supervisors.add(s);
      await audit('TAMBAH', 'Sasaran (Profil Penilai)', isi);
      setInfo(`Sasaran "${name}" ditambahkan. Klik "Siapkan Isian Penilaian" lalu lanjut ke menu Penilaian V2.`);
    }
    tutupForm();
  }

  async function hapusSemuaSasaran() {
    if (!sasaran.length) return setInfo('Belum ada sasaran untuk dihapus.');
    const berhasil = await db.results.toArray();
    const dipakai = sasaran.filter(x => berhasil.some(r => r.supervisorId === x.id));
    if (dipakai.length) {
      return alert(
        `Tidak dapat menghapus semua: ${dipakai.length} pengawas sudah memiliki hasil penilaian ` +
        `(${dipakai.map(x => x.name).join(', ')}). Hapus satu per satu setelah hasilnya diolah.`,
      );
    }
    if (!confirm(`Hapus SEMUA ${sasaran.length} sasaran beserta isian penilaiannya? Tindakan ini tidak dapat dibatalkan.`)) return;
    await db.supervisors.bulkDelete(sasaran.map(x => x.id));
    const idSasaran = new Set(sasaran.map(x => x.id));
    const isian = (await db.assessments.toArray()).filter(a => idSasaran.has(a.supervisorId));
    if (isian.length) await db.assessments.bulkDelete(isian.map(a => a.id));
    await audit('HAPUS_SEMUA', 'Sasaran (Profil Penilai)', `${sasaran.length} sasaran, ${isian.length} isian`);
    setInfo(`Semua sasaran dihapus (${sasaran.length} pengawas, ${isian.length} isian penilaian).`);
  }

  async function hapusSasaran(x: Supervisor) {
    if (await db.results.where('supervisorId').equals(x.id).count()) {
      return alert('Tidak dapat dihapus: pengawas ini sudah memiliki hasil penilaian.');
    }
    const jml = await db.assessments.where('supervisorId').equals(x.id).count();
    if (jml && !confirm(`Pengawas ini punya ${jml} isian penilaian yang belum final. Tetap dihapus?`)) return;
    await db.supervisors.delete(x.id);
    await audit('HAPUS', 'Sasaran (Profil Penilai)', undefined, x);
  }

  async function siapkanAssessments() {
    if (!aku) return setInfo('Isi profil penilai dulu (nama + NIP) agar dapat menyiapkan. ');
    const ins = await db.indicators.filter(i => i.versiInstrumen === 'pkpm-0-2-v2').toArray();
    const rows = ps
      .filter(x => x.id !== aku.id)
      .flatMap(x => ins.map(i => ({
        ...emptyAssessment(x.id, aku.id, i.id),
        id: `${x.id}-${i.id}`,
        supervisorId: x.id,
        assessorId: aku.id,
      })));
    if (!rows.length) return setInfo('Belum ada sasaran atau instrumen.');
    const ada = new Set((await db.assessments.where('assessorId').equals(aku.id).toArray()).map(a => a.id));
    const baru = rows.filter(r => !ada.has(r.id));
    if (!baru.length) return setInfo('Semua isian penilaian sudah tersedia.');
    await db.assessments.bulkPut(baru);
    await audit('SIAPKAN_ASSESSMENT', `${baru.length} isian`, aku.name);
    setInfo(`${baru.length} isian penilaian disiapkan. Lanjutkan ke menu Penilaian V2.`);
  }

  const sasaran = useMemo(() => ps.filter(x => x.id !== aku?.id), [ps, aku?.id]);

  return (
    <>
      <PageTitle
        title="Profil Penilai &amp; Sasaran"
        desc="Isi identitas penilai dan daftar pengawas yang Anda nilai — data tersimpan di perangkat ini"
      />

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <UserRound size={18} className="text-[#173f70]" />
          <h3 className="font-bold text-[#173f70]">Identitas Penilai</h3>
        </div>
        {p?.nama ? (
          <div className="grid md:grid-cols-4 gap-3 text-sm mb-4">
            <div><span className="text-slate-500">Nama</span><p className="font-semibold">{p.nama}</p></div>
            <div><span className="text-slate-500">NIP</span><p className="font-semibold">{p.nip || '-'}</p></div>
            <div><span className="text-slate-500">Jabatan</span><p className="font-semibold">{p.jabatan || '-'}</p></div>
            <div><span className="text-slate-500">Unit Kerja</span><p className="font-semibold">{p.unit || '-'}</p></div>
            <div><span className="text-slate-500">Kabupaten</span><p className="font-semibold">{p.kabupaten || '-'}</p></div>
            <div className="md:col-span-3"><span className="text-slate-500">Kop Surat</span>
              <p className="font-semibold whitespace-pre-line">{(p.kop || []).filter(Boolean).join('\n') || '-'}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            Profil penilai belum diisi. Isi dulu nama dan NIP agar hasil penilaian mudah digabung oleh Ketua Pokjawas.
          </p>
        )}
        <div className="grid md:grid-cols-4 gap-3">
          <label className="text-sm md:col-span-2">Nama penilai
            <input className="input mt-1" value={nama} onChange={e => setNama(e.target.value)} placeholder={p?.nama || 'Nama lengkap'} />
          </label>
          <label className="text-sm">NIP
            <input className="input mt-1" value={nip} inputMode="numeric" maxLength={18}
              onChange={e => setNip(e.target.value.replace(/\D/g, ''))}
              placeholder="18 digit" />
            <span className={`block text-xs mt-1 ${nip && nip.length !== 18 ? 'text-amber-600' : 'text-slate-400'}`}>
              {nip ? `${nip.length} dari 18 angka` : 'Boleh dikosongkan'}
            </span>
          </label>
          <label className="text-sm">Kabupaten
            <input className="input mt-1" value={kabupaten} onChange={e => setKabupaten(e.target.value)}
              placeholder={p?.kabupaten || 'Contoh: Jember'} />
          </label>
          <label className="text-sm md:col-span-2">Jabatan
            <input className="input mt-1" value={jabatan} onChange={e => setJabatan(e.target.value)} placeholder={p?.jabatan || 'Pengawas Madya'} />
          </label>
          <label className="text-sm md:col-span-2">Unit kerja
            <input className="input mt-1" value={unit} onChange={e => setUnit(e.target.value)} placeholder={p?.unit || 'Pokjawas Jember'} />
          </label>
        </div>

        {/* Kop surat untuk dokumen cetak (Cetak Instrumen) */}
        <div className="mt-5 pt-4 border-t border-slate-200">
          <h4 className="font-bold text-sm text-[#173f70] mb-1">Kop Surat Kementerian Agama</h4>
          <p className="text-xs text-slate-500 mb-3">
            Empat baris kop yang dipakai pada dokumen <b>Cetak Instrumen</b>. Kosongkan bila ingin memakai teks bawaan.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm md:col-span-2">Baris 1
              <input className="input mt-1" value={kop1} onChange={e => setKop1(e.target.value)}
                placeholder={p?.kop?.[0] || 'KEMENTERIAN AGAMA REPUBLIK INDONESIA'} />
            </label>
            <label className="text-sm md:col-span-2">Baris 2
              <input className="input mt-1" value={kop2} onChange={e => setKop2(e.target.value)}
                placeholder={p?.kop?.[1] || 'KANTOR KEMENTERIAN AGAMA KABUPATEN JEMBER'} />
            </label>
            <label className="text-sm md:col-span-2">Baris 3
              <input className="input mt-1" value={kop3} onChange={e => setKop3(e.target.value)}
                placeholder={p?.kop?.[2] || 'Jalan ... Nomor ... Telepon ...'} />
            </label>
            <label className="text-sm md:col-span-2">Baris 4
              <input className="input mt-1" value={kop4} onChange={e => setKop4(e.target.value)}
                placeholder={p?.kop?.[3] || 'Website ... / Email ...'} />
            </label>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {profilErr && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {profilErr}
            </p>
          )}
          {profilOk && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              {profilOk}
            </p>
          )}
          <Button onClick={simpanProfil}>{p?.nama ? 'Perbarui Profil' : 'Simpan Profil'}</Button>
        </div>
      </Card>

      {/* ===== Pejabat Penandatangan ===== */}
      <Card className="mt-5">
        <h3 className="font-bold text-[#173f70] mb-1">Pejabat Penandatangan</h3>
        <p className="text-xs text-slate-500 mb-4">Nama &amp; NIP ini akan terisi otomatis pada tanda tangan laporan PDF.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm block">Ketua Pokjawas Madrasah
              <input className="input mt-1" value={ketuaPokjawas} onChange={e => setKetuaPokjawas(e.target.value)}
                placeholder={orgRow?.chairman || 'Nama lengkap + gelar'} />
            </label>
            <label className="text-sm block">NIP Ketua Pokjawas
              <input className="input mt-1" value={nipKetua} inputMode="numeric" maxLength={18}
                onChange={e => setNipKetua(e.target.value.replace(/\D/g, ''))} placeholder="18 digit NIP" />
            </label>
          </div>
          <div className="space-y-2">
            <label className="text-sm block">Kepala Kantor Kemenag
              <input className="input mt-1" value={kepalaKantor} onChange={e => setKepalaKantor(e.target.value)}
                placeholder={orgRow?.headOffice || 'Nama lengkap + gelar'} />
            </label>
            <label className="text-sm block">NIP Kepala Kantor
              <input className="input mt-1" value={nipKantor} inputMode="numeric" maxLength={18}
                onChange={e => setNipKantor(e.target.value.replace(/\D/g, ''))} placeholder="18 digit NIP" />
            </label>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {pejabatErr && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {pejabatErr}
            </p>
          )}
          {pejabatOk && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              {pejabatOk}
            </p>
          )}
          <Button size="sm" onClick={simpanPejabat}>Simpan Penandatangan</Button>
        </div>
      </Card>

      <Card className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-[#173f70]">Pengawas yang Saya Nilai</h3>
            <p className="text-xs text-slate-500">Daftar sasaran di perangkat ini. Hasilnya nanti digabung Ketua Pokjawas.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="light" onClick={siapkanAssessments}>Siapkan Isian Penilaian</Button>
            <Button size="sm" variant="danger" onClick={hapusSemuaSasaran} disabled={!sasaran.length}>
              <Trash2 size={14} className="inline" /> Hapus Semua Sasaran
            </Button>
            <Button size="sm" onClick={tambahSasaran}><Plus size={14} className="inline" /> Tambah Sasaran</Button>
          </div>
        </div>

        {/* ===== Form Tambah/Ubah Sasaran ===== */}
        {form && (
          <div className="border-2 border-[#173f70]/25 rounded-xl p-4 mb-4 bg-slate-50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-[#173f70]">
                {formId ? 'Ubah Data Sasaran' : 'Tambah Sasaran Baru'}
              </h4>
              <button onClick={tutupForm} className="text-slate-400 hover:text-slate-700" title="Tutup form">
                <X size={18} />
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <label className="text-sm md:col-span-2">Nama lengkap &amp; gelar <span className="text-red-600">*</span>
                <input className="input mt-1" value={form.name} autoFocus
                  onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Ahmad Fauzi, S.Pd, M.Pd." />
              </label>
              <label className="text-sm">NIP (18 digit) <span className="text-red-600">*</span>
                <input className="input mt-1" value={form.nip} inputMode="numeric" maxLength={18}
                  onChange={e => setForm({ ...form, nip: e.target.value.replace(/\D/g, '') })} placeholder="197002122005011004" />
              </label>
              <label className="text-sm">Jabatan
                <input className="input mt-1" value={form.position}
                  onChange={e => setForm({ ...form, position: e.target.value })} placeholder="Pengawas Madrasah" />
              </label>
              <label className="text-sm">Jenjang Jabatan
                <select className="input mt-1" value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}>
                  {['Muda', 'Madya', 'Utama'].map(x => <option key={x}>{x}</option>)}
                </select>
              </label>
              <label className="text-sm">Pangkat / Golongan
                <input className="input mt-1" value={form.rank}
                  onChange={e => setForm({ ...form, rank: e.target.value })} placeholder="Contoh: Pembina / IV a" />
              </label>
              <label className="text-sm md:col-span-2">Unit Kerja
                <input className="input mt-1" value={form.workUnit}
                  onChange={e => setForm({ ...form, workUnit: e.target.value })} placeholder="Kantor Kementerian Agama Kab. Jember" />
              </label>
              <label className="text-sm">Wilayah Binaan / KKMA
                <input className="input mt-1" value={form.region}
                  onChange={e => setForm({ ...form, region: e.target.value })} placeholder="Contoh: KKMA 04 Sukowono" />
              </label>
              <label className="text-sm">No. HP
                <input className="input mt-1" value={form.phone} inputMode="tel"
                  onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="08xxxxxxxxxx" />
              </label>
              <label className="text-sm md:col-span-2">Email
                <input className="input mt-1" value={form.email} type="email"
                  onChange={e => setForm({ ...form, email: e.target.value })} placeholder="nama@example.id" />
              </label>
            </div>

            {formErr && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 mt-3">{formErr}</p>
            )}

            <div className="flex gap-2 mt-4">
              <Button onClick={simpanSasaran}>
                <Save size={15} className="inline" /> {formId ? 'Simpan Perubahan' : 'Simpan Sasaran'}
              </Button>
              <Button variant="light" onClick={tutupForm}>Batal</Button>
              <span className="text-xs text-slate-500 self-center ml-1">
                Kolom bertanda <span className="text-red-600">*</span> wajib diisi.
              </span>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <AlertTriangle size={16} className="text-[#173f70] mt-0.5 shrink-0" />
          <p className="text-xs text-slate-700">
            Tidak perlu membagi sasaran dari satu komputer. Tiap penilai menuliskan sasarannya sendiri di
            perangkatnya. Sesuai kesepakatan: <b>satu pengawas dinilai satu penilai</b>. Bila sampai muncul
            baris <b>konflik</b> di menu Gabung Data, artinya pengawas itu terdaftar di dua perangkat —
            cukup pilih satu hasil yang dipakai, tidak perlu dirata-rata.
          </p>
        </div>

        {info && <p className="text-sm text-[#173f70] bg-slate-100 rounded-lg p-3 mb-4">{info}</p>}

        {sasaran.length ? (
          <Table
            heads={['Nama', 'NIP', 'Jabatan', 'Wilayah', 'Aksi']}
            rows={sasaran.map(x => [
              x.name, x.nip, x.position || '-', x.region || '-',
              <div className="flex gap-2">
                <IconButton title="Ubah" onClick={() => ubahSasaran(x)}>
                  <Pencil size={16} />
                </IconButton>
                <IconButton title="Hapus" variant="danger" onClick={() => hapusSasaran(x)}>
                  <Trash2 size={16} />
                </IconButton>
              </div>,
            ])}
          />
        ) : (
          <p className="text-center p-8 text-slate-400">Belum ada sasaran. Klik "Tambah Sasaran" untuk menambahkan.</p>
        )}
      </Card>
    </>
  );
}
