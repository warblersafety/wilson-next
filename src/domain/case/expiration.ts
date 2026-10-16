import {isCompleteCalendarDate} from './calendar-date';
export interface PartialExpiration {precision:'month'|'year';year:string;month?:string;wording:string}
export type ExpirationValue=string|PartialExpiration;
export function isPartialExpiration(value:unknown):value is PartialExpiration {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).every(k=>['precision','year','month','wording'].includes(k))&&typeof v.year==='string'&&/^\d{4}$/.test(v.year)&&Number(v.year)>0&&typeof v.wording==='string'&&Boolean(v.wording.trim())&&(v.precision==='year'?v.month===undefined:v.precision==='month'&&typeof v.month==='string'&&/^(0[1-9]|1[0-2])$/.test(v.month));
}
export const isExpirationValue=(v:unknown):v is ExpirationValue=>isCompleteCalendarDate(v)||isPartialExpiration(v);
export function expirationText(value:PartialExpiration,qualifier?:string):string {
 return [`Supplied expiration precision: ${value.precision==='month'?value.year+'-'+value.month:value.year} (${value.precision==='month'?'month and year only':'year only'}).`,`Exact supplied wording: ${value.wording}`,...(qualifier?[`Uncertainty or context: ${qualifier}`]:[]),'No missing month or day has been inferred.'].join('\n');
}
