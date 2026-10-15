import {purchaseCountryLabel,type PurchaseDetailField} from "../../domain/case/purchase-details";
import {nativeSingleLineTextLimitation} from "./product-text";
export const purchaseNativeGeometry = [
  {
    "purchaseSellerName": {
      "name": "topmostSubform[0].Page4[0].Prod1[0].Prod1PlaceName[0]",
      "width": 523.981,
      "fontSize": 8.5,
      "maxLength": 125
    },
    "purchaseSellerAddress": {
      "name": "topmostSubform[0].Page4[0].Prod1[0].Prod1Address[0]",
      "width": 523.981,
      "fontSize": 8.5,
      "maxLength": 125
    },
    "purchaseSellerCity": {
      "name": "topmostSubform[0].Page4[0].Prod1[0].Prod1City[0]",
      "width": 215.76799999999997,
      "fontSize": 8.5,
      "maxLength": null
    },
    "purchaseSellerRegion": {
      "name": "topmostSubform[0].Page4[0].Prod1[0].Prod1State[0]",
      "width": 229.75099999999998,
      "fontSize": 8.5,
      "maxLength": null
    },
    "purchaseSellerPostalCode": {
      "name": "topmostSubform[0].Page4[0].Prod1[0].ZipCode[0]",
      "width": 68.87599999999998,
      "fontSize": 8.5,
      "maxLength": 10
    },
    "purchaseSellerCountry": {
      "name": "topmostSubform[0].Page4[0].Prod1[0].Prod1Country[0]",
      "width": 523.928,
      "fontSize": 8.5,
      "maxLength": null
    },
    "purchaseWebsite": {
      "name": "topmostSubform[0].Page4[0].Prod1[0].Prod1Website[0]",
      "width": 428.049,
      "fontSize": 8.5,
      "maxLength": 70
    }
  },
  {
    "purchaseSellerName": {
      "name": "topmostSubform[0].Page5[0].Prod2[0].Prod2PlaceName[0]",
      "width": 521.983,
      "fontSize": 8.5,
      "maxLength": 125
    },
    "purchaseSellerAddress": {
      "name": "topmostSubform[0].Page5[0].Prod2[0].Prod2Address[0]",
      "width": 521.983,
      "fontSize": 8.5,
      "maxLength": 125
    },
    "purchaseSellerCity": {
      "name": "topmostSubform[0].Page5[0].Prod2[0].Pdt2City[0]",
      "width": 215.768,
      "fontSize": 8.5,
      "maxLength": null
    },
    "purchaseSellerRegion": {
      "name": "topmostSubform[0].Page5[0].Prod2[0].Pdt2State[0]",
      "width": 229.75100000000003,
      "fontSize": 8.5,
      "maxLength": null
    },
    "purchaseSellerPostalCode": {
      "name": "topmostSubform[0].Page5[0].Prod2[0].ZipCode[0]",
      "width": 68.87599999999998,
      "fontSize": 8.5,
      "maxLength": 10
    },
    "purchaseSellerCountry": {
      "name": "topmostSubform[0].Page5[0].Prod2[0].Pdt2Country[0]",
      "width": 523.928,
      "fontSize": 8.5,
      "maxLength": null
    },
    "purchaseWebsite": {
      "name": "topmostSubform[0].Page5[0].Prod2[0].Pdt2Website[0]",
      "width": 428.049,
      "fontSize": 8.5,
      "maxLength": 70
    }
  }
] as const;
export function purchaseDetailLimitation(field:PurchaseDetailField,value:string,index:number):string|undefined {
 if (!value.trim()) return "has no non-blank wording";
 if (field==="purchaseSellerCountry" && !purchaseCountryLabel(value)) return "does not match an explicitly selected native country; the original wording is retained without guessing a country";
 const g=purchaseNativeGeometry[index][field];
 if(g.maxLength!==null && value.length>g.maxLength) return "exceeds the native purchase control character capacity";
 return nativeSingleLineTextLimitation(value,g.width,g.fontSize,"purchase detail control");
}
