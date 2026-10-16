import {nativeSingleLineTextLimitation} from "./product-text";
import {multilineTextLimitation} from "./multiline-text";
/** Pinned09/2025 native SectionE widget geometry/DA, independently checked with pypdf. */
export const deviceTextFields=[
 {projected:"brandName",fact:"name",label:"Brand name",width:233.524,height:14.094,fontSize:8.5,maxLength:Number.MAX_SAFE_INTEGER,multiline:false},
 {projected:"commonName",fact:"commonName",label:"Common name",width:231.137,height:14.094,fontSize:8.5,maxLength:Number.MAX_SAFE_INTEGER,multiline:false},
 {projected:"procode",fact:"procode",label:"Procode",width:52.155,height:14.094,fontSize:8.5,maxLength:3,multiline:false},
 {projected:"manufacturer",fact:"manufacturer",label:"Manufacturer",width:530.164,height:14.094,fontSize:8.5,maxLength:Number.MAX_SAFE_INTEGER,multiline:false},
 {projected:"modelNumber",fact:"modelNumber",label:"Model number",width:119.752,height:14.094,fontSize:8.5,maxLength:Number.MAX_SAFE_INTEGER,multiline:false},
 {projected:"lotNumber",fact:"lotNumber",label:"Lot number",width:138.747,height:14.094,fontSize:8.5,maxLength:Number.MAX_SAFE_INTEGER,multiline:false},
 {projected:"catalogNumber",fact:"catalogNumber",label:"Catalog number",width:260.64,height:14.094,fontSize:8.5,maxLength:Number.MAX_SAFE_INTEGER,multiline:false},
 {projected:"serialNumber",fact:"serialNumber",label:"Serial number",width:386.62,height:14.094,fontSize:8.5,maxLength:Number.MAX_SAFE_INTEGER,multiline:false},
 {projected:"udi",fact:"udi",label:"UDI",width:530.164,height:127.483,fontSize:8,maxLength:1000,multiline:true},
 {projected:"reprocessor",fact:"reprocessor",label:"Reprocessor",width:258.639,height:29.752,fontSize:8.5,maxLength:Number.MAX_SAFE_INTEGER,multiline:true},
] as const;
export async function deviceTextLimitation(field:typeof deviceTextFields[number]["projected"],text:string):Promise<string|undefined>{
 const g=deviceTextFields.find(g=>g.projected===field)!;
 if(text.length>g.maxLength)return `exceeds the native ${g.label} character capacity`;
 return g.multiline?multilineTextLimitation(text,g):nativeSingleLineTextLimitation(text,g.width,g.fontSize,`Section E ${g.label} control`);
}
