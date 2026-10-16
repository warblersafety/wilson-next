import {test,expect} from "@playwright/test";
import {browserStateVersion} from "../../src/server/case/browser-state";
import {correctCapacityProduct,productCapacityCase,capacityProductNames} from "../fixtures/product-capacity";
import {seedStoredState,storedState,goTo,savePdf,serverAction} from "./draft4-helpers";
import {execFile} from "node:child_process";import {promisify} from "node:util";
test("two explicit concomitants now print separate native F rows and role correction reallocates without changing identity",async({page},info)=>{
 let interpretations=0;await page.route("**/api/case",async r=>{if(["submit-opening","submit-update"].includes(r.request().postDataJSON()?.action?.action)){interpretations++;await r.abort();}else await r.continue();});
 const c=correctCapacityProduct(productCapacityCase(),1,{role:{kind:"known",value:"concomitant"}});await page.goto("/");await seedStoredState(page,{version:browserStateVersion,stage:"output",case:c,unrepresented:[]});await page.reload();await expect(page.getByRole("button",{name:"New case",exact:true})).toBeEnabled();
 const d=await savePdf(page),file=info.outputPath("two-concomitants.pdf");await d.saveAs(file);const x=JSON.parse((await promisify(execFile)(process.env.PYPDF_PYTHON??"python3",["tools/pdf/independent_readback.py",file,"--named"])).stdout);for(let i=1;i<=2;i++)expect(x.namedFields[`topmostSubform[0].Page6[0].SecF_Other[0].Table1[0].Row${i}[0].Prod${i}[0]`]).toBe(capacityProductNames[i]);
 await goTo(page,"Review details");const row=page.locator('#case-card-product-2 [data-field="role"]');await row.getByRole("button",{name:"Change",exact:true}).click();await row.getByLabel("New Role",{exact:true}).selectOption("suspect");await serverAction(page,()=>row.getByRole("button",{name:"Apply correction",exact:true}).click());const after=(await storedState(page)).case;expect(after.products[0]).toEqual(c.products[0]);expect(after.products[2]).toEqual(c.products[2]);expect(after.products[1].id).toBe(c.products[1].id);await goTo(page,"Review & save");await expect(page.getByRole("link",{name:"Save PDF",exact:true})).toBeVisible();expect(interpretations).toBe(0);
});
