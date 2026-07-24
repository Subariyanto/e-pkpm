export type Role='admin'|'assessor'; export type Status='draft'|'process'|'final';
export interface Org {id:string;name:string;district:string;province:string;chairman:string;headOffice:string;address:string;phone:string;email:string;period:string}
export interface User {id:string;name:string;username:string;pinHash:string;roles:Role[];nip:string;active:boolean;failed:number;lockedUntil?:number}
export interface Supervisor {id:string;name:string;nip:string;rank:string;position:string;level:string;workUnit:string;region:string;schools:number;principals:number;teachers:number;phone:string;email:string;assessorId?:string;active:boolean}
export interface Indicator {id:string;component:'K1'|'K2'|'K3'|'K4';subcomponent:string;code:string;description:string;documents:string[];weight:number;maxScore:number;required:boolean;pkb:string;active:boolean;order:number;descriptors:Record<number,string>}
export interface Assessment {id:string;supervisorId:string;assessorId:string;periodId:string;indicatorId:string;documentName:string;documentNumber:string;documentDate:string;documentStatus:string;review:string;score?:number;notes:string;finding:string;recommendation:string;updatedAt:string}
export interface Result {id:string;supervisorId:string;assessorId:string;periodId:string;scores:Record<string,number>;componentScores:Record<string,number>;finalScore:number;predicate:string;priorities:string[];status:Status;finalizedAt?:string}
export interface Period {id:string;year:number;schoolYear:string;start:string;end:string;status:'draft'|'active'|'closed'|'locked'}
export interface Audit {id?:number;user:string;at:string;action:string;object:string;oldValue?:string;newValue?:string;reason?:string;device:string}
