import {useState} from 'react';import {useLiveQuery} from 'dexie-react-hooks';import {db} from '../lib/db';import { Button, Card, PageTitle } from '../components/Layout';
import { fullBackup, restore, seedDemo, exportJson, checksumPackage, download, instrumenAktif } from '../services/core';
import { generateIndividualPdf, generateBatchPdf, printPdf, downloadBlob, generatePrioritasPkbPdf, openPdfTab } from '../services/pdfReport';
import { generateBukuLaporan } from '../services/laporanBuku';
import { hitungPrioritasPkb } from '../services/prioritasPkb';
import { calculate } from '../services/core';
import { BOBOT_DEFAULT, PREDIKAT_DEFAULT } from '../data/demo';
import type { Assessment, Indicator, Result, Supervisor } from '../types';
const Table=({heads,rows}:{heads:string[],rows:any[][]})=><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-100">{heads.map(h=><th className="p-3 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr className="border-b" key={i}>{r.map((x,j)=><td className="p-3 whitespace-nowrap" key={j}>{x}</td>)}</tr>)}</tbody></table></div>;
export function Recap(){
 const rs=useLiveQuery(()=>db.results.toArray(),[])||[],ps=useLiveQuery(()=>db.supervisors.toArray(),[])||[],us=useLiveQuery(()=>db.users.toArray(),[])||[],ins=useLiveQuery(()=>db.indicators.toArray(),[])||[],asms=useLiveQuery(()=>db.assessments.toArray(),[])||[];
 const [cetak,setCetak]=useState('');
 /**
  * Data mentah penilaian untuk satu pengawas (dipakai generator PDF).
  */
  async function bahanCetak(r:Result){
   const supervisor=ps.find(x=>x.id===r.supervisorId);
   if(!supervisor)throw Error('Data pengawas tidak ditemukan');
   const items=asms.filter(a=>a.supervisorId===supervisor.id);
   if(!items.length)throw Error(`Belum ada isian penilaian untuk ${supervisor.name}`);
   const master=instrumenAktif(ins);
   const org=await db.org.toCollection().first();
   const regulasi=await db.regulasi.toArray();
   const penilai=us.find(x=>x.id===r.assessorId)?.name;
   return {supervisor,items,master,result:r,regulasi,org,penilai};
  }
 /** Buka pratinjau cetak satu pengawas pada tab baru (dialog cetak bawaan browser). */
  async function cetakSatu(r:Result){
   setCetak(`Menyiapkan pratinjau ${ps.find(x=>x.id===r.supervisorId)?.name||''}…`);
   try{const b=await bahanCetak(r);const blob=await generateIndividualPdf(b.supervisor,b.items,b.master,b.result,b.regulasi,b.org||{name:'Pokjawas Jember',chairman:'',headOffice:''},b.penilai);const ok=printPdf(blob);setCetak(ok?'Pengaturan Cetak terbuka di tab baru. Atur orientasi (potret/lanskap) lalu cetak atau simpan PDF.':'Penyesuaian cetak diblokir browser. Izinkan pop-up untuk pkpm.pokjawasjember.com lalu coba lagi.')}
   catch(x:any){setCetak(x?.message||String(x))}
  }
 /** Pratinjau cetak semua pengawas dalam satu PDF gabungan (satu pengawas satu halaman). */
  async function cetakSemua(finalSaja=false){
   const daftar=finalSaja?rs.filter(r=>r.status==='final'):rs;
   if(!daftar.length)return setCetak(finalSaja?'Belum ada hasil berstatus final.':'Belum ada hasil penilaian untuk dicetak.');
   try{
    const kumpulan=[];
    for(const [n,r] of daftar.entries()){
     setCetak(`Menyiapkan ${n+1}/${daftar.length}…`);
     kumpulan.push(await bahanCetak(r));
    }
    const blob=await generateBatchPdf(kumpulan,await db.org.toCollection().first()||{name:'Pokjawas Jember',chairman:'',headOffice:''},us);
    const ok=printPdf(blob);
    setCetak(ok?`Pengaturan Cetak terbuka dengan ${daftar.length} laporan dalam satu berkas PDF (satu pengawas satu halaman). Atur orientasi lalu cetak atau simpan PDF.`:'Penyesuaian cetak diblokir browser. Izinkan pop-up untuk pkpm.pokjawasjember.com lalu coba lagi.');
   }catch(x:any){setCetak(x?.message||String(x))}
  }
 const rows=rs.map((r,i)=>{const p=ps.find(x=>x.id===r.supervisorId),u=us.find(x=>x.id===r.assessorId);const scores=asms.filter(a=>a.supervisorId===r.supervisorId&&!a.na).map(a=>({id:a.indicatorId,score:a.score??0}));const low=scores.sort((a,b)=>a.score-b.score)[0];return [i+1,p?.name,p?.nip,u?.name,...['K1','K2','K3','K4'].map(k=>(r.componentScores[k]||0).toFixed(2)),r.finalScore.toFixed(2),r.predicate,ins.find(x=>x.id===low?.id)?.code||'-',r.status,<div className="flex gap-2"><Button size="sm" variant="light" onClick={()=>cetakSatu(r)}>Cetak</Button></div>]});async function excel(){const XLSX=await import('xlsx');const ws=XLSX.utils.aoa_to_sheet([['No','Nama','NIP','Penilai','K1','K2','K3','K4','Akhir','Predikat','Indikator Terendah','Status'],...rows]);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Rekap');XLSX.writeFile(wb,'Rekap-PKPM.xlsx')}const pkb=useLiveQuery(async()=>hitungPrioritasPkb(await db.assessments.toArray(),await db.indicators.toArray(),5),[ins,asms])||[];
 async function eksporPkb(){const XLSX=await import('xlsx');const org=await db.org.toCollection().first();const aoa=[['No','Kode','Indikator','Rata-rata Skor','Skor Maksimal','Capaian (%)','Jumlah Dinilai','Pengawas Skor <=1','Rekomendasi PKB'],...pkb.map(x=>[x.peringkat,x.indikator.code,x.indikator.title||x.indikator.description,Number(x.rataRata.toFixed(2)),x.indikator.maxScore||2,Number(x.capaianPersen.toFixed(1)),x.jumlahDinilai,x.jumlahLemah,x.indikator.pkb||'-'])];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Dokumen','Prioritas PKB Kabupaten'],['Organisasi',org?.name||'-'],['Periode',org?.period||'2026'],['Pengawas Dinilai',String(rs.length)],['Sumber','e-PKPM']]),'Identitas');const ws=XLSX.utils.aoa_to_sheet(aoa);ws['!cols']=[{wch:5},{wch:8},{wch:46},{wch:14},{wch:13},{wch:12},{wch:14},{wch:19},{wch:40}];XLSX.utils.book_append_sheet(wb,ws,'Prioritas PKB');XLSX.writeFile(wb,`Prioritas-PKB-${(org?.district||'Kabupaten').replace(/^kabupaten\s+/i,'')}-${org?.period||'2026'}.xlsx`)}
 async function cetakPkb(){try{const org=await db.org.toCollection().first();const blob=await generatePrioritasPkbPdf(pkb.map(x=>({peringkat:x.peringkat,code:x.indikator.code,title:x.indikator.title||x.indikator.description,rataRata:x.rataRata,jumlahDinilai:x.jumlahDinilai,jumlahLemah:x.jumlahLemah,capaianPersen:x.capaianPersen,pkb:x.indikator.pkb||'-'})),org||{name:'Pokjawas Jember',chairman:'',headOffice:''},{periode:org?.period,jumlahPengawas:rs.length});setCetak(printPdf(blob)?`Pengaturan Cetak terbuka dengan lembar Prioritas PKB (${pkb.length} butir). Atur orientasi lalu cetak atau simpan PDF.`:'Penyesuaian cetak diblokir browser. Izinkan pop-up untuk pkpm.pokjawasjember.com lalu coba lagi.')}catch(x:any){setCetak(x?.message||String(x))}}
 return <><PageTitle title="Rekap Hasil & Prioritas PKB" desc="Nilai Kabupaten dan indikator terendah" action={<div className="flex flex-wrap gap-2"><Button onClick={excel}>Ekspor Excel</Button><Button variant="light" onClick={()=>cetakSemua(true)} disabled={!!cetak}>Cetak Semua Pengawas</Button></div>}/>{cetak&&<Card className="mb-4"><p className="text-sm text-[#173f70]">{cetak}</p></Card>}<Card><Table heads={['No','Pengawas','NIP','Penilai','K1','K2','K3','K4','Akhir','Predikat','Terendah','Status','Cetak']} rows={rows}/></Card><PageTitle title="Lima Prioritas PKB Kabupaten" desc="Agregasi indikator dengan skor terendah" action={<div className="flex flex-wrap gap-2"><Button onClick={cetakPkb} disabled={!pkb.length}>Cetak Prioritas PKB</Button><Button variant="light" onClick={eksporPkb} disabled={!pkb.length}>Ekspor Excel PKB</Button></div>}/><div className="grid md:grid-cols-2 gap-3">{pkb.length?pkb.map((x,n)=><Card key={x.indikator.id}><b>{n+1}. {x.indikator.code} · {x.indikator.title||x.indikator.description}</b><p className="text-sm">Rata-rata skor: {x.rataRata.toFixed(2)} / {(x.indikator.maxScore||2).toFixed(2)} · Capaian: {x.capaianPersen.toFixed(1)}% · Rendah: {x.jumlahLemah} pengawas · Dinilai: {x.jumlahDinilai} pengawas</p><p className="text-xs text-slate-500">Rekomendasi: {x.indikator.pkb}</p></Card>):<Card className="md:col-span-2"><b className="text-slate-700">Belum ada prioritas PKB yang dapat dihitung.</b><p className="text-sm text-slate-500 mt-2">Daftar prioritas disusun dari butir instrumen baku (versi PKPM 0-2 v2) yang sudah memiliki skor penilaian. Saat ini belum ada butir berskor yang cocok.</p><p className="text-sm text-slate-500 mt-2">Langkah yang dapat dilakukan: pastikan butir instrumen baku sudah ada di menu <b>Kelola Instrumen</b> (versi PKPM 0-2 v2), lalu isi penilaian pada menu <b>Penilaian V2</b>.</p></Card>}</div></>}
export function Transfer(){const [msg,setMsg]=useState('');async function assignment(){const org=await db.org.toCollection().first(),users=await db.users.toArray(),ps=await db.supervisors.toArray(),ins=await db.indicators.toArray();await exportJson('ASSIGNMENT',{organization:org,period:'2026',assessors:users,supervisors:ps,instruments:ins,uniqueCode:crypto.randomUUID()})}async function results(){const rs=await db.results.where('status').equals('final').toArray();if(!rs.length)return setMsg('Tidak ada hasil final untuk diekspor.');await exportJson('RESULT',{period:'2026',results:rs,assessments:await db.assessments.toArray(),supervisors:await db.supervisors.toArray()})}async function imp(f:File){const o=JSON.parse(await f.text()),org=await db.org.toCollection().first();if(await checksumPackage(o)!==o.checksum)throw Error('Checksum tidak valid');if(o.organizationId!==org?.id)throw Error('organizationId berbeda');if(o.packageType==='RESULT'){if(o.results.some((x:any)=>x.status!=='final'))throw Error('Ada hasil belum final');await fullBackup();await db.results.bulkPut(o.results);await db.assessments.bulkPut(o.assessments);setMsg(`${o.results.length} hasil berhasil diimpor.`)}else if(o.packageType==='ASSIGNMENT'){await db.supervisors.bulkPut(o.supervisors);await db.indicators.bulkPut(o.instruments);setMsg('Paket penugasan berhasil diimpor.')}}return <><PageTitle title="Paket Penugasan & Impor Hasil" desc="Paket JSON ber-checksum dan terikat organisasi"/><div className="grid md:grid-cols-3 gap-4"><Card><b>Buat Paket Penugasan</b><p className="text-sm text-slate-500 my-3">Identitas penilai, sasaran, instrumen, bobot, konfigurasi.</p><Button onClick={assignment}>Unduh Paket</Button></Card><Card><b>Ekspor Hasil Penilai</b><p className="text-sm text-slate-500 my-3">Hanya hasil berstatus final.</p><Button onClick={results}>Unduh Hasil</Button></Card><Card><b>Impor Paket/Hasil</b><p className="text-sm text-slate-500 my-3">Validasi checksum dan organisasi otomatis.</p><input type="file" accept=".json" onChange={e=>e.target.files?.[0]&&imp(e.target.files[0]).catch(x=>setMsg(x.message))}/></Card></div>{msg&&<Card className="mt-4">{msg}</Card>}</>}
export function Backup(){const logs=useLiveQuery(()=>db.audits.reverse().limit(100).toArray(),[])||[];return <><PageTitle title="Backup, Restore & Audit" desc="Data disimpan pada browser. Lakukan backup berkala." action={<Button onClick={fullBackup}>Backup Seluruh Data</Button>}/><Card><b>Restore Data</b><p className="text-sm text-red-600 my-2">Backup otomatis dibuat sebelum restore.</p><input type="file" accept=".json" onChange={e=>e.target.files?.[0]&&confirm('Restore akan mengganti data lokal. Lanjutkan?')&&restore(e.target.files[0]).then(()=>location.reload()).catch(x=>alert(x.message))}/></Card><Card className="mt-5"><h3 className="font-bold mb-3">Audit Log</h3><Table heads={['Waktu','Pengguna','Aktivitas','Objek','Alasan']} rows={logs.map(x=>[new Date(x.at).toLocaleString('id-ID'),x.user,x.action,x.object,x.reason||'-'])}/></Card></>}
export function Reports(){
 const rs=useLiveQuery(()=>db.results.toArray(),[])||[];
 const [pesan,setPesan]=useState('');
 const [sibuk,setSibuk]=useState('');
 async function data(){return {org:await db.org.toCollection().first(),ps:await db.supervisors.toArray(),ins:await db.indicators.toArray()}}
 async function pdf(kind:'kantor'|'kanwil'){
  setSibuk(kind);setPesan('');
  try{
   const {org,ps,ins}=await data();
   const asms=await db.assessments.toArray();
   /**
    * Lima prioritas PKB memakai modul bersama services/prioritasPkb supaya
    * angka pada laporan identik dengan halaman Rekap & PKB.
    */
   const pkb=hitungPrioritasPkb(asms,ins,5);
   const prioritas=pkb.map(x=>({kode:x.indikator.code,judul:x.indikator.title||x.indikator.description,rataRata:x.rataRata,jumlahLemah:x.jumlahLemah,rekomendasi:x.indikator.pkb||'-'}));
   const rekap=rs.map((r,i)=>{const p=ps.find(x=>x.id===r.supervisorId);return {no:i+1,nama:p?.name||'-',nip:p?.nip||'-',k1:(r.componentScores?.K1||0).toFixed(2),k2:(r.componentScores?.K2||0).toFixed(2),k3:(r.componentScores?.K3||0).toFixed(2),k4:(r.componentScores?.K4||0).toFixed(2),akhir:r.finalScore.toFixed(2),predikat:r.predicate};});
   const blob=await generateBukuLaporan({
    kind,
    org:org||{name:'Pokjawas Madrasah',chairman:'',headOffice:''},
    hasil:rs,pengawas:ps,instrumen:ins,rekap,prioritas,
    jumlahPenilai:new Set(rs.map(r=>r.assessorId)).size,
   });
   const nama=kind==='kantor'?'Laporan-Kepala-Kantor-PKPM':'Bahan-Laporan-Kanwil-PKPM';
   setPesan(printPdf(blob)?`Pengaturan Cetak terbuka: ${nama}.pdf memuat cover, pengesahan, kata pengantar, daftar isi, Bab I-VI, dan lampiran rekap (${rs.length} pengawas, ${pkb.length} prioritas PKB). Atur orientasi lalu cetak atau simpan PDF.`:'Penyesuaian cetak diblokir browser. Izinkan pop-up untuk pkpm.pokjawasjember.com lalu coba lagi.');
  }catch(x:any){setPesan('Gagal menyusun laporan: '+(x?.message||String(x)))}
  finally{setSibuk('')}
 }
 async function xlsx(kind:'kantor'|'kanwil'){const XLSX=await import('xlsx');const {org,ps,ins}=await data();const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Jenis',kind],['Organisasi',org?.name],['Kabupaten',org?.district],['Periode',org?.period],['Kepala Kantor',org?.headOffice],['Ketua Pokjawas',org?.chairman]]),'Identitas');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rs.map(r=>({Pengawas:ps.find(p=>p.id===r.supervisorId)?.name,NIP:ps.find(p=>p.id===r.supervisorId)?.nip,K1:r.componentScores?.K1,K2:r.componentScores?.K2,K3:r.componentScores?.K3,K4:r.componentScores?.K4,Nilai:r.finalScore,Predikat:r.predicate,Status:r.status}))),'Rekap');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(hitungPrioritasPkb(await db.assessments.toArray(),ins,5).map(x=>({Kode:x.indikator.code,Indikator:x.indikator.title||x.indikator.description,Rata_rata:Number(x.rataRata.toFixed(2)),Capaian_persen:Number(x.capaianPersen.toFixed(1)),Skor_rendah:x.jumlahLemah,Rekomendasi_PKB:x.indikator.pkb||'-'}))),'Prioritas PKB');XLSX.writeFile(wb,kind==='kantor'?'Laporan-Kepala-Kantor-PKPM.xlsx':'Bahan-Laporan-Kanwil-PKPM.xlsx')}
 const daftarIsi=[
  'Cover',
  'Halaman Pengesahan + tanda tangan tiga pihak',
  'Kata Pengantar',
  'Daftar Isi',
  'Bab I Pendahuluan - latar belakang, dasar hukum, tujuan, ruang lingkup, sistematika',
  'Bab II Pelaksanaan - waktu, sasaran, penilai, tahapan, metode dan instrumen, kendala',
  'Bab III Hasil dan Analisis Penilaian - sebaran, per komponen, peringkat, kekuatan, kelemahan, faktor',
  'Bab IV Prioritas PKB - dasar penyusunan, tabel lima prioritas, rencana pelaksanaan',
  'Bab V Rekomendasi - bagi kepala kantor, pengawas, pokjawas, dan madrasah binaan',
  'Bab VI Penutup',
  'Lampiran - rekap hasil dalam bentuk tabel',
 ];
 return <><PageTitle title="Generator Laporan" desc="Laporan berbab lengkap: cover, pengesahan, kata pengantar, daftar isi, Bab I-VI, lampiran"/>{pesan&&<Card className="mb-4"><p className="text-sm text-[#173f70]">{pesan}</p></Card>}<div className="grid md:grid-cols-2 gap-4">
  <Card><h3 className="font-bold">Laporan Kepala Kantor</h3><p className="text-sm text-slate-500 my-3">Laporan lengkap berbab sesuai sistematika resmi, dilengkapi halaman pengesahan tiga tanda tangan dan lampiran rekap hasil.</p><div className="flex gap-2"><Button onClick={()=>pdf('kantor')} disabled={!!sibuk}>{sibuk==='kantor'?'Menyusun...':'Cetak / Simpan PDF'}</Button><Button variant="light" onClick={()=>xlsx('kantor')}>Excel</Button></div></Card>
  <Card><h3 className="font-bold">Bahan Laporan Kanwil</h3><p className="text-sm text-slate-500 my-3">Sistematika sama dengan laporan Kepala Kantor, digunakan sebagai bahan pelaporan tingkat Kanwil.</p><div className="flex gap-2"><Button onClick={()=>pdf('kanwil')} disabled={!!sibuk}>{sibuk==='kanwil'?'Menyusun...':'Cetak / Simpan PDF'}</Button><Button variant="light" onClick={()=>xlsx('kanwil')}>Excel</Button></div></Card>
 </div><Card className="mt-5"><h3 className="font-bold mb-3">Sistematika Laporan</h3><ol className="text-sm text-slate-600 list-decimal pl-5 space-y-1">{daftarIsi.map(x=><li key={x}>{x}</li>)}</ol></Card></>}
export function Settings(){return <><PageTitle title="Pengaturan Aplikasi" desc="Profil Pokjawas, tampilan, dokumen dan keamanan"/><div className="grid md:grid-cols-2 gap-4"><Card><h3 className="font-bold">Data Demo</h3><p className="text-sm text-slate-500 my-3">1 organisasi, 8 penilai, 50 pengawas, instrumen K1–K4. PIN demo: 123456.</p><div className="flex gap-2"><Button onClick={()=>seedDemo().then(()=>location.reload())}>Aktifkan Data Demo</Button><Button variant="danger" onClick={()=>confirm('Hapus seluruh data demo?')&&Promise.all(db.tables.map(t=>t.clear())).then(()=>location.reload())}>Hapus Data Demo</Button></div></Card><Card><h3 className="font-bold">Tampilan</h3><p className="text-sm text-slate-500 my-3">Tema biru tua, putih, aksen emas; responsif desktop/mobile.</p><Button variant="light" onClick={()=>document.documentElement.classList.toggle('dark')}>Ganti Mode</Button></Card></div></>}
export function Placeholder({title}:{title:string}){return <><PageTitle title={title}/><Card><p>Modul terintegrasi melalui data lokal IndexedDB. Gunakan menu terkait untuk mengelola alur PKPM.</p></Card></>}