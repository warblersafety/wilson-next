import {expect,it} from 'vitest';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {productCapacityCase} from '../fixtures/product-capacity';
import {setContextFact} from '../fixtures/reviewed-context';
import {projectForm3500} from '../../src/domain/case/projection';
import {fillForm3500Projection} from '../../src/server/pdf/form-3500';
import {getJourneySnapshot} from '../../src/server/journey/service';
import {InMemoryCaseRepository} from '../../src/server/case/repository';
import {getFact,targetFromKey} from '../../src/domain/case/facts';
const source=()=>readFile('assets/fda/form-fda-3500-09-2025.pdf').then(b=>new Uint8Array(b));
it.each(['event:event:onsetDate','event:event:dischargeDate','product:product-apixaban:startDate','product:product-apixaban:expirationDate','product:product-lisinopril:stopDate','test:test-hemoglobin:date'])('legacy invalid %s is retained and blocks both readiness and PDF before any output',async target=>{
 const c=structuredClone(setContextFact(productCapacityCase(),target,{kind:'known',value:'2028-02-29'}));getFact(c,targetFromKey(c,target)).resolvedValue!.value={kind:'known',value:'2026-02-30'};const before=structuredClone(c),projection=projectForm3500(c);
 expect(projection.invalidCalendarDates).toEqual([{target,value:'2026-02-30'}]);expect((await getJourneySnapshot(new InMemoryCaseRepository({initialCase:c}),c.id)).outputIssues).toContainEqual(expect.objectContaining({code:'invalid-calendar-date',targets:[target]}));await expect(fillForm3500Projection(await source(),projection)).rejects.toThrow('invalid calendar');expect(c).toEqual(before);
});
it('native adapter independently rejects an impossible direct projected date even without case validation metadata',async()=>{
 const p=projectForm3500(productCapacityCase());delete p.invalidCalendarDates;p.sections.B.eventDate='2026-02-30';await expect(fillForm3500Projection(await source(),p)).rejects.toThrow('calendar date');
});
it('valid leap dates print unchanged in B3, D3/D6, and B6 with independent PDF reader',async()=>{
 let c=productCapacityCase();for(const target of ['event:event:onsetDate','product:product-apixaban:startDate','product:product-apixaban:expirationDate','test:test-hemoglobin:date'])c=setContextFact(c,target,{kind:'known',value:'2028-02-29'});
 const result=await fillForm3500Projection(await source(),projectForm3500(c)),file=join(await mkdtemp(join(tmpdir(),'wilson164-')),'calendar.pdf');await writeFile(file,result.output);const pdf=JSON.parse((await promisify(execFile)(process.env.PYPDF_PYTHON??'python3',['tools/pdf/independent_readback.py',file,'--named','--page-text'])).stdout);
 expect(pdf.pageCount).toBe(8);expect(Object.values(pdf.namedFields).filter(v=>v==='29-FEB-2028').length).toBeGreaterThanOrEqual(4);expect(pdf.pageTexts.join('\n')).not.toContain('30-FEB');
});
