import {suppliedDateText,type PartialDate} from './date-precision';
export {isPartialDate as isPartialExpiration,isSuppliedDate as isExpirationValue} from './date-precision';
export type {PartialDate as PartialExpiration,SuppliedDate as ExpirationValue} from './date-precision';
export const expirationText=(value:PartialDate,qualifier?:string)=>suppliedDateText(value,'expiration',qualifier);
