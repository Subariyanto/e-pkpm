import Dexie, { type Table } from 'dexie';
import type { Org, User, Supervisor, Indicator, Assessment, Result, Period, Audit, Snapshot, Regulation, ActivationCode } from '../types';
type Setting={key:string;value:unknown};
export class PKPMDatabase extends Dexie {
 org!:Table<Org,string>; users!:Table<User,string>; supervisors!:Table<Supervisor,string>;
 indicators!:Table<Indicator,string>; assessments!:Table<Assessment,string>; results!:Table<Result,string>;
 periods!:Table<Period,string>; audits!:Table<Audit,number>; settings!:Table<Setting,string>; imports!:Table<Record<string,unknown>,string>;
 snapshots!:Table<Snapshot,string>; regulations!:Table<Regulation,string>; regulasi!:Table<Regulation,string>;
 activationCodes!:Table<ActivationCode,string>;
 constructor(){super('ePKPM');
  // Skema v1 — dipertahankan; tidak ada tabel/record lama yang dihapus.
  this.version(1).stores({
   org:'id', users:'id,&username', supervisors:'id,&nip,assessorId', indicators:'id,component,code,order',
   assessments:'id,[supervisorId+indicatorId],supervisorId,assessorId,periodId', results:'id,supervisorId,assessorId,periodId,status',
   periods:'id,status', audits:'++id,at,user,action', settings:'key', imports:'id,assessorId,periodId'
  });
  // Skema v2 — menambah tabel snapshots & regulations + indeks version pada indikator.
  this.version(2).stores({
   org:'id', users:'id,&username', supervisors:'id,&nip,assessorId', indicators:'id,component,code,order,version',
   assessments:'id,[supervisorId+indicatorId],supervisorId,assessorId,periodId', results:'id,supervisorId,assessorId,periodId,status',
   periods:'id,status', audits:'++id,at,user,action', settings:'key', imports:'id,assessorId,periodId',
   snapshots:'id,at,supervisorId,periodId', regulations:'id,status,order'
  });
  // Skema v3 — menambah alias tabel `regulasi`.
  // Kode (seedDemo, RegulasiPage) memakai db.regulasi, sedangkan skema v1/v2
  // hanya mendaftarkan `regulations`. Tanpa entri di sini, Dexie tidak membuat
  // tabelnya sehingga muncul "Cannot read properties of undefined (reading 'bulkAdd')".
  // Migrasi menyalin data lama agar tidak ada yang hilang.
  this.version(3).stores({
   org:'id', users:'id,&username', supervisors:'id,&nip,assessorId', indicators:'id,component,code,order,version',
   assessments:'id,[supervisorId+indicatorId],supervisorId,assessorId,periodId', results:'id,supervisorId,assessorId,periodId,status',
   periods:'id,status', audits:'++id,at,user,action', settings:'key', imports:'id,assessorId,periodId',
   snapshots:'id,at,supervisorId,periodId', regulations:'id,status,order', regulasi:'id,status,order'
  }).upgrade(async tx => {
   const lama = await tx.table('regulations').toArray();
   if (lama.length) await tx.table('regulasi').bulkPut(lama);
  });
  // Skema v4 — tabel `activationCodes` untuk Opsi A (1 kode aktivasi = 1 akun,
  // data tetap lokal; penggabungan antar perangkat lewat Menu Backup & Restore).
  this.version(4).stores({
   org:'id', users:'id,&username,activationCode', supervisors:'id,&nip,assessorId', indicators:'id,component,code,order,version',
   assessments:'id,[supervisorId+indicatorId],supervisorId,assessorId,periodId,updatedAt', results:'id,supervisorId,assessorId,periodId,status',
   periods:'id,status', audits:'++id,at,user,action', settings:'key', imports:'id,assessorId,periodId',
   snapshots:'id,at,supervisorId,periodId', regulations:'id,status,order', regulasi:'id,status,order',
   activationCodes:'id,&code,active'
  });
 }
}
export const db=new PKPMDatabase();
export const audit=async(action:string,object:string,newValue?:unknown,oldValue?:unknown,reason?:string)=>db.audits.add({user:sessionStorage.getItem('userName')||'Sistem',at:new Date().toISOString(),action,object,newValue:JSON.stringify(newValue??''),oldValue:JSON.stringify(oldValue??''),reason,device:navigator.userAgent});
/** Buat snapshot data (sebelum reset/migrasi/buka-kunci). Tidak pernah menghapus data. */
export async function snapshot(kind:string,data:unknown,opts:{supervisorId?:string;periodId?:string}={}){const s:Snapshot={id:crypto.randomUUID(),at:new Date().toISOString(),user:sessionStorage.getItem('userName')||'Sistem',kind,supervisorId:opts.supervisorId,periodId:opts.periodId,data:JSON.stringify(data)};await db.snapshots.put(s);return s}
