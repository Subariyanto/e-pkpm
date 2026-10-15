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
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, audit } from '../lib/db';
import { Button, Card, PageTitle, IconButton } from '../components/Layout';
import { emptyAssessment } from './assessment/helpers';
import type { Supervisor } from '../types';
import { UserRound, Plus, Trash2, AlertTriangle, Pencil } from 'lucide-react';

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
  const [info, setInfo] = useState('');

  const profil = useLiveQuery(() => db.settings.get('profilPenilai'), []);
  const p = profil?.value as { nama?: string; nip?: string; jabatan?: string; unit?: string } | undefined;

  const ps = useLiveQuery(() => db.supervisors.toArray(), []) || [];
  const aku = useMemo(() => ps.find(x => x.nip === p?.nip), [ps, p?.nip]);

  async function simpanProfil() {
    const n = (nama || p?.nama || '').trim();
    const pin = (nip || p?.nip || '').trim();
    const j = (jabatan || p?.jabatan || '').trim();
    const u = (unit || p?.unit || '').trim();
    if (!n) return setInfo('Nama penilai wajib diisi.');
    if (pin && !/^\d{18}$/.test(pin)) return setInfo('NIP wajib 18 digit angka (boleh dikosongkan).');
    if (pin) {
      const bentrok = await db.supervisors.where('nip').equals(pin).first();
      if (bentrok && bentrok.name !== n) {
        return setInfo(`NIP ${pin} sudah dipakai pengawas "${bentrok.name}". Periksa kembali.`);
      }
    }
    await db.settings.put({ key: 'profilPenilai', value: { nama: n, nip: pin, jabatan: j, unit: u } });
    await audit('PROFIL_PENILAI', n, { nip: pin });
    setNama(''); setNip(''); setJabatan(''); setUnit('');
    setInfo('Profil penilai tersimpan di perangkat ini.');
  }

  async function tambahSasaran() {
    const name = prompt('Nama pengawas yang dinilai');
    if (!name) return;
    const pin = prompt('NIP (18 digit)') || '';
    if (!/^\d{18}$/.test(pin)) return alert('NIP wajib 18 digit angka');
    if (p?.nip && pin === p.nip) return alert('Penilai tidak boleh menilai dirinya sendiri.');
    if (await db.supervisors.where('nip').equals(pin).count()) return alert('NIP sudah terdaftar sebagai sasaran.');
    const s: Supervisor = {
      id: crypto.randomUUID(), name, nip: pin, rank: '', position: 'Pengawas Madrasah',
      level: '', workUnit: '', region: '', schools: 0, principals: 0, teachers: 0,
      phone: '', email: '', active: true,
      assessorId: p?.nip || p?.nama || 'penilai-lokal',
    };
    await db.supervisors.add(s);
    await audit('TAMBAH', 'Sasaran (Profil Penilai)', name);
  }

  async function ubahSasaran(x: Supervisor) {
    const name = prompt('Nama pengawas', x.name);
    if (!name) return;
    const nip = prompt('NIP (18 digit)', x.nip) || '';
    if (!/^\d{18}$/.test(nip)) return alert('NIP wajib 18 digit angka');
    if (p?.nip && nip === p.nip) return alert('Penilai tidak boleh menilai dirinya sendiri.');
    const bentrok = await db.supervisors.where('nip').equals(nip).first();
    if (bentrok && bentrok.id !== x.id) return alert('NIP sudah dipakai sasaran lain.');
    const position = prompt('Jabatan', x.position || 'Pengawas Madrasah') || x.position;
    const region = prompt('Wilayah', x.region || '') ?? x.region;
    await db.supervisors.update(x.id, { name, nip, position, region });
    await audit('UBAH', 'Sasaran (Profil Penilai)', { name, nip }, x);
    setInfo(`Data sasaran "${name}" diperbarui.`);
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
          </div>
        ) : (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            Profil penilai belum diisi. Isi dulu nama dan NIP agar hasil penilaian mudah digabung oleh Ketua Pokjawas.
          </p>
        )}
        <div className="grid md:grid-cols-4 gap-3">
          <label className="text-sm">Nama penilai
            <input className="input mt-1" value={nama} onChange={e => setNama(e.target.value)} placeholder={p?.nama || 'Nama lengkap'} />
          </label>
          <label className="text-sm">NIP
            <input className="input mt-1" value={nip} onChange={e => setNip(e.target.value)} placeholder={p?.nip || '18 digit'} />
          </label>
          <label className="text-sm">Jabatan
            <input className="input mt-1" value={jabatan} onChange={e => setJabatan(e.target.value)} placeholder={p?.jabatan || 'Pengawas Madya'} />
          </label>
          <label className="text-sm">Unit kerja
            <input className="input mt-1" value={unit} onChange={e => setUnit(e.target.value)} placeholder={p?.unit || 'Pokjawas Jember'} />
          </label>
        </div>
        <div className="mt-4">
          <Button onClick={simpanProfil}>{p?.nama ? 'Perbarui Profil' : 'Simpan Profil'}</Button>
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
