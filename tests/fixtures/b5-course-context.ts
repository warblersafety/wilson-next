import { contextCase, setContextFact } from "./reviewed-context";
export const courseContext = {
  treatments: "patient reports fluids first; sequence after the second treatment is uncertain",
  outcome: "improvement reported later; timing relative to discharge remains uncertain",
  dischargeDate: "copied from discharge note; exact departure time unknown",
} as const;
export function courseContextCase() {
  let current = contextCase();
  current = setContextFact(current, "event:event:treatments", { kind: "known", value: ["oral fluids reported first", "second treatment reported later"], qualifier: courseContext.treatments });
  current = setContextFact(current, "event:event:outcome", { kind: "known", value: "improved but not back to baseline", qualifier: courseContext.outcome });
  return setContextFact(current, "event:event:dischargeDate", { kind: "known", value: "2026-08-21", qualifier: courseContext.dischargeDate });
}
