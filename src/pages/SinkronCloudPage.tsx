import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, PageTitle } from '../components/Layout';
import { db } from '../lib/db';
import {
  cekKoneksi, konfigAktif, simpanKonfig, pullDariAwan, pushKeAwan,
  type FirebaseConfig, type SyncInfo, type SyncResult,
} from '../services/firebaseCloud';

const CONTOH = `{
  "apiKey": "AIza...",
  "authDomain": "nama-project.firebaseapp.com",
  "projectId": "nama-project",
  "appId": "1:1234567890:web:abc123",
  "storageBucket": "nama-project.appspot.com",
  "messagingSenderId": "1234567890"
}`;

export function SinkronCloud() {
  const [teks, setTeks] = useState('');
  const [info, setInfo] = useState<SyncInfo | null>(null);
  const [hasil, setHasil] = useState<SyncResult | null>(null);
  const [sibuk, setSibuk] = useState<'' | 'push' | 'pull' | 'cek' | 'simpan'>('');
  const [err, setErr] = useState('');
  const [timpa, setTimpa] = useState(false);
  const [diagnostik, setDiagnostik] = useState('');

  useEffect(() => {
    const aktif = konfigAktif();
    if (aktif) setTeks(JSON.stringify(aktif, null, 2));
    cekKoneksi().then(setInfo).catch(() => setInfo({ online: false }));
  }, []);

  function bacaForm(): FirebaseConfig {
    let obj: FirebaseConfig;
    try {
      obj = JSON.parse(teks);
    } catch {
      throw new Error('Teks konfigurasi bukan JSON yang valid. Salin ulang dari Firebase Console.');
    }
    if (!obj.apiKey || !obj.projectId) throw new Error('Konfigurasi wajib memuat apiKey dan projectId.');
    return obj;
  }

  async function jalankan(jenis: 'push' | 'pull' | 'cek' | 'simpan') {
    setErr(''); setHasil(null);
    setSibuk(jenis);
    try {
      if (jenis === 'simpan') {
        const cfg = bacaForm();
        simpanKonfig(cfg);
        setInfo(await cekKoneksi());
      } else if (jenis === 'cek') {
        setInfo(await cekKoneksi());
      } else if (jenis === 'push') {
        // Tangkap log internal pushKeAwan agar penyebab "0 dokumen" terlihat.
        const log: string[] = [];
        const asli = console.log;
        const asliErr = console.error;
        const asliWarn = console.warn;
        console.log = (...a: any[]) => { log.push(a.map(String).join(' ')); asli(...a); };
        console.error = (...a: any[]) => { log.push('[ERR] ' + a.map(String).join(' ')); asliErr(...a); };
        console.warn = (...a: any[]) => { log.push('[WARN] ' + a.map(String).join(' ')); asliWarn(...a); };
        try {
          setHasil(await pushKeAwan(db));
        } finally {
          console.log = asli; console.error = asliErr; console.warn = asliWarn;
        }
        // Hitung record per tabel untuk ditampilkan.
        const hitung: string[] = [];
        for (const t of db.tables) {
          try { const n = await t.count(); hitung.push(`${t.name}: ${n}`); } catch { hitung.push(`${t.name}: ?`); }
        }
        setDiagnostik(log.join('\n') + '\n---\n' + hitung.join(', '));
        setHasil(await pullDariAwan(db, { timpa }));
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setSibuk('');
    }
  }

  const aktif = konfigAktif();

  return (
    <>
      <PageTitle
        title="Sinkron Cloud (Firebase)"
        desc="Data penilaian tetap tersimpan di perangkat; Firebase menjadi salinan daring agar bisa dipakai bersama antar pengawas."
        action={<Link to="/backup"><Button variant="light">Backup Lokal</Button></Link>}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <h3 className="font-bold mb-2">1. Konfigurasi Project Firebase</h3>
          <p className="text-sm text-slate-500 mb-3">
            Buka <b>Firebase Console → Project settings → Your apps (Web)</b>, salin objek
            <code className="mx-1">firebaseConfig</code> lalu tempel di bawah. Cukup sekali per perangkat.
          </p>
          <textarea
            className="w-full h-56 font-mono text-xs p-3 border rounded-xl bg-slate-50"
            placeholder={CONTOH}
            value={teks}
            onChange={e => setTeks(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            <Button onClick={() => jalankan('simpan')} disabled={!!sibuk}>
              {sibuk === 'simpan' ? 'Menyimpan…' : 'Simpan Konfigurasi'}
            </Button>
            <Button variant="light" onClick={() => jalankan('cek')} disabled={!!sibuk}>
              {sibuk === 'cek' ? 'Memeriksa…' : 'Uji Koneksi'}
            </Button>
            {aktif && (
              <Button
                variant="light"
                onClick={() => { simpanKonfig(null); setTeks(''); setInfo({ online: false }); setHasil(null); }}
              >
                Hapus Konfigurasi
              </Button>
            )}
          </div>
          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        </Card>

        <Card>
          <h3 className="font-bold mb-2">Status</h3>
          <p className="text-sm">
            Konfigurasi: <b>{aktif ? 'terisi' : 'belum ada'}</b>
          </p>
          <p className="text-sm">
            Project: <b>{info?.projectId || '-'}</b>
          </p>
          <p className="text-sm">
            Koneksi ke Firestore:{' '}
            <b className={info?.online ? 'text-emerald-600' : 'text-red-600'}>
              {info?.online ? 'berhasil' : 'belum terhubung'}
            </b>
          </p>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            Bila "belum terhubung" padahal konfigurasi benar, periksa Security Rules sudah
            terpasang dan login aplikasi sudah memakai akun Firebase Auth.
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="font-bold mb-2">2. Kirim & Tarik Data</h3>
          <p className="text-sm text-slate-500 mb-3">
            <b>Kirim ke awan</b> menyalin data lokal ke Firestore (dokumen yang tidak berubah
            otomatis dilewati agar hemat kuota). <b>Tarik dari awan</b> mengambil data terbaru
            dari Firestore ke perangkat ini.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => jalankan('push')} disabled={!!sibuk || !aktif}>
              {sibuk === 'push' ? 'Mengirim…' : 'Kirim ke Awan'}
            </Button>
            <Button variant="light" onClick={() => jalankan('pull')} disabled={!!sibuk || !aktif}>
              {sibuk === 'pull' ? 'Menarik…' : 'Tarik dari Awan'}
            </Button>
          </div>
          <label className="flex items-start gap-2 text-sm mt-3 text-slate-600">
            <input type="checkbox" checked={timpa} onChange={e => setTimpa(e.target.checked)} className="mt-1" />
            <span>
              Tarik dengan <b>menimpa</b> data lokal. Hanya untuk perangkat baru yang masih kosong —
              data lokal lama akan dihapus.
            </span>
          </label>
          {diagnostik && (
            <details className="mt-3">
              <summary className="text-xs text-slate-500 cursor-pointer">Diagnostik push (klik untuk melihat)</summary>
              <pre className="mt-2 text-xs bg-slate-900 text-slate-100 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap">{diagnostik}</pre>
            </details>
          )}
          {hasil && (
            <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm">
              <p className="font-semibold text-emerald-800">{hasil.pesan}</p>
              <p className="text-emerald-700 text-xs mt-1">
                Durasi {(hasil.durasiMs / 1000).toFixed(1)} detik · dikirim {hasil.pushed} · ditarik {hasil.pulled} · dilewati {hasil.skipped}
              </p>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-bold mb-2">Catatan</h3>
          <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
            <li>Data lokal tidak pernah dihapus oleh tombol "Kirim ke Awan".</li>
            <li>Konfigurasi Firebase tersimpan di perangkat ini saja.</li>
            <li>Paket kuota gratis cukup untuk pemakaian sekali setahun.</li>
            <li>Backup JSON di menu Backup tetap disarankan sebelum sinkronisasi besar.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
