import {isCompleteCalendarDate} from './calendar-date';
export interface PartialDate {precision:'month'|'year';year:string;month?:string;wording:string}
export type SuppliedDate=string|PartialDate;
export const productDateFields=['purchaseDate','startDate','stopDate','doseReductionDate'] as const;
export const deviceDateFields=['implantDate','explantDate'] as const;
export type ProductDateField=typeof productDateFields[number]|typeof deviceDateFields[number];
export const productDateLabels={purchaseDate:'Purchase date',startDate:'Therapy start date',stopDate:'Therapy stop date',doseReductionDate:'Dose-reduction date',implantDate:'Implant date',explantDate:'Explant date'} as const;
export const isProductDateField=(field:string):field is ProductDateField=>([...productDateFields,...deviceDateFields] as readonly string[]).includes(field);
export function isPartialDate(value:unknown):value is PartialDate {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).every(k=>['precision','year','month','wording'].includes(k))&&typeof v.year==='string'&&/^\d{4}$/.test(v.year)&&Number(v.year)>0&&typeof v.wording==='string'&&Boolean(v.wording.trim())&&(v.precision==='year'?v.month===undefined:v.precision==='month'&&typeof v.month==='string'&&/^(0[1-9]|1[0-2])$/.test(v.month));
}
export const isSuppliedDate=(v:unknown):v is SuppliedDate=>isCompleteCalendarDate(v)||isPartialDate(v);
export function suppliedDateText(value:PartialDate,label:string,qualifier?:string):string {
 return [`Supplied ${label} precision: ${value.precision==='month'?value.year+'-'+value.month:value.year} (${value.precision==='month'?'month and year only':'year only'}).`,`Exact supplied wording: ${value.wording}`,...(qualifier?[`Uncertainty or context: ${qualifier}`]:[]),'No missing month or day has been inferred.'].join('\n');
}

export const eventDateFields=['onsetDate','deathDate','dischargeDate'] as const;
export type EventDateField=typeof eventDateFields[number];
export const eventDateLabels={onsetDate:'Event onset date',deathDate:'Death date',dischargeDate:'Discharge date'} as const;
export const isEventDateField=(field:string):field is EventDateField=>(eventDateFields as readonly string[]).includes(field);
