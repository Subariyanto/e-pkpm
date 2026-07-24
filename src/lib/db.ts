import Dexie, { type Table } from 'dexie';
import type { Org, User, Supervisor, Indicator, Assessment, Result, Period, Audit } from '../types';
type Setting={key:string;value:unknown};
export class PKPMDatabase extends Dexie {
 org!:Table<Org,string>; users!:Table<User,string>; supervisors!:Table<Supervisor,string>;
 indicators!:Table<Indicator,string>; assessments!:Table<Assessment,string>; results!:Table<Result,string>;
 periods!:Table<Period,string>; audits!:Table<Audit,number>; settings!:Table<Setting,string>; imports!:Table<Record<string,unknown>,string>;
 constructor(){super('ePKPM');this.version(1).stores({
  org:'id', users:'id,&username', supervisors:'id,&nip,assessorId', indicators:'id,component,code,order',
  assessments:'id,[supervisorId+indicatorId],supervisorId,assessorId,periodId', results:'id,supervisorId,assessorId,periodId,status',
  periods:'id,status', audits:'++id,at,user,action', settings:'key', imports:'id,assessorId,periodId'
 });}
}
export const db=new PKPMDatabase();
export const audit=async(action:string,object:string,newValue?:unknown,oldValue?:unknown,reason?:string)=>db.audits.add({user:sessionStorage.getItem('userName')||'Sistem',at:new Date().toISOString(),action,object,newValue:JSON.stringify(newValue??''),oldValue:JSON.stringify(oldValue??''),reason,device:navigator.userAgent});
