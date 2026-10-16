import { expect, it } from "vitest";
import { listWithContext } from "../../src/domain/case/list-context";
import { projectForm3500 } from "../../src/domain/case/projection";
import { browserStateVersion, parseBrowserJourneyState } from "../../src/server/case/browser-state";
import { listContext, listContextCase, listValues, listConflict } from "../fixtures/list-context";
import { setContextFact } from "../fixtures/reviewed-context";
it.each(["symptoms","treatments"]as const)("labels %s whole-list context without item attribution or mutation",field=>{
 const c=listContextCase(),before=structuredClone(c),text=projectForm3500(c).sections.B.eventDescription!;
 expect(text).toContain(`${field==="symptoms"?"Symptoms":"Treatment"}: ${listValues[field].join(field==="symptoms"?" and ":"; ")}. ${field==="symptoms"?"Symptoms":"Treatment"} list context: ${listContext[field]}.`);expect(c).toEqual(before);expect(parseBrowserJourneyState({version:browserStateVersion,stage:"output",case:c,unrepresented:[]}).case).toEqual(c);
});
it.each(["symptoms","treatments"]as const)("unaccepted %s alternative leaves current context; accepted conflict omits all disputed context",field=>{
 const {pending,accepted}=listConflict(field);expect(projectForm3500(pending).sections.B.eventDescription).toContain(listContext[field]);expect(projectForm3500(pending).sections.B.eventDescription).not.toContain("observation");expect(accepted.event.facts[field].state).toBe("conflicted");expect(projectForm3500(accepted).sections.B.eventDescription).not.toContain(listContext[field]);expect(accepted.event.facts[field].conflictingValues).toHaveLength(2);
});
it.each((["symptoms","treatments"]as const).flatMap(field=>(["unknown","declined","inapplicable","explicitly-absent"]as const).map(kind=>({field,kind}))))("current $field $kind never resurrects historical whole-list context",({field,kind})=>{
 const c=setContextFact(listContextCase(),`event:event:${field}`,{kind});expect(projectForm3500(c).sections.B.eventDescription).not.toContain(listContext[field]);expect(c.event.facts[field].supersededValues.some(v=>v.value.kind==="known"&&v.value.qualifier===listContext[field])).toBe(true);
});
it("does not parse or rewrite context mentioning one item or punctuation",()=>{const q="vitamin K only? (record A); IV fluids timing unknown.";expect(listWithContext("IV fluids; vitamin K",q)).toBe(`IV fluids; vitamin K. Context for this list: ${q}`);expect(listWithContext("IV fluids; vitamin K")).toBe("IV fluids; vitamin K");});
