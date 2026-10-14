import type { RetainedDraft } from "../src/browser/workspace-state";
import type { JourneySnapshot } from "../src/server/journey/service";
import { factControl, type FactControlEntity } from "./fact-controls";
import styles from "./page.module.css";

const titles = { card: "Earlier field edits", reporter: "Earlier reporter details", indications: "Earlier medicine indications", "serious-outcomes": "Earlier serious outcomes", "death-date": "Earlier date of death", "clinical-context": "Earlier tests and history", "device-details": "Earlier device answers", "medication-history": "Earlier medication answers" };
const labels: Record<string, string> = {
  firstName: "First name", lastName: "Last name", address: "Address", city: "City", state: "State", postalCode: "ZIP/postal code", country: "Country", phone: "Phone", email: "Email", occupation: "Occupation", reportDate: "Date of this report", healthProfessional: "Health professional", reportedTo: "Also reported to", doNotDiscloseIdentity: "Do not disclose identity",
  testChoice: "Test information", historyChoice: "History information", testName: "Test name", testResult: "Test result", lowRange: "Low range", highRange: "High range", testDate: "Test date", history: "Relevant history", implantChoice: "Implant date information", explantChoice: "Explant date information", reprocessorChoice: "Reprocessor information", implantDate: "Implant date", explantDate: "Explant date", reprocessor: "Reprocessor", stopped: "Stopped", doseReduced: "Dose reduced", stopDate: "Stop date", improvedAfterChange: "Improved after change", restarted: "Restarted", recurred: "Recurred", date: "Date", selected: "Selected outcomes",
};
const words: Record<string, string> = { known: "Provided", unknown: "Unknown", declined: "Prefer not to answer", inapplicable: "Not applicable", "explicitly-absent": "None reported", death: "Death", lifeThreatening: "Life threatening", hospitalized: "Hospitalized", disability: "Disability", requiredIntervention: "Required intervention", congenitalAnomaly: "Congenital anomaly", otherSerious: "Other serious outcome", manufacturer: "Manufacturer or compounder", "user-facility": "User facility", "distributor-importer": "Distributor or importer", packer: "Packer" };
function valueText(value: unknown): string {
  if (value === undefined || value === "") return "(blank)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return words[value] ?? value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length ? value.map(valueText).join("; ") : "(none selected)";
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    if (item.kind === "known") return `${valueText(item.value)}${typeof item.qualifier === "string" ? ` — ${item.qualifier === "" ? "(blank context)" : item.qualifier}` : ""}`;
    if (typeof item.kind === "string") return words[item.kind] ?? "Not supplied";
    if ("value" in item && "unit" in item) return `${valueText(item.value)} ${valueText(item.unit)}`;
  }
  return "Not supplied";
}
function rows(item: RetainedDraft, snapshot: JourneySnapshot): Array<[string, string]> {
  const record = item.record;
  if (record.kind === "card") {
    let entity: FactControlEntity | undefined;
    try { const scope = JSON.parse(record.scope); if (["patient", "event", "product", "test", "reporter"].includes(scope[0])) entity = scope[0]; } catch { /* No internal identity is displayed. */ }
    return Object.entries(record.data.drafts).map(([field, value]) => [entity ? factControl(entity, field)?.label ?? "Earlier value" : "Earlier value", valueText(value)]);
  }
  if (record.kind === "reporter") return Object.entries({ ...record.data.values, reportDate: record.data.reportDate, healthProfessional: record.data.healthProfessional, reportedTo: record.data.reportedTo, doNotDiscloseIdentity: record.data.doNotDiscloseIdentity }).map(([field, value]) => [labels[field], valueText(value)]);
  if (record.kind === "indications") {
    return [...new Set([...Object.keys(record.data.choices), ...Object.keys(record.data.texts)])].flatMap((id, index) => {
      const product = snapshot.understanding.products.find(item => item.id === id);
      const name = product?.facts.name.resolved;
      const title = name?.kind === "known" ? String(name.value) : `Earlier medicine ${index + 1}`;
      return [[`${title}: answer`, valueText(record.data.choices[id])], [`${title}: indication`, valueText(record.data.texts[id])]] as Array<[string, string]>;
    });
  }
  const data = record.kind === "medication-history" ? record.data.answers : record.data;
  return Object.entries(data).map(([field, value]) => [labels[field] ?? "Earlier answer", valueText(value)]);
}
export function RetainedDrafts({ items, snapshot }: { items: RetainedDraft[]; snapshot: JourneySnapshot }) {
  if (!items.length) return null;
  return <aside className={styles.notice} aria-label="Retained unfinished work"><p>Some earlier unfinished edits need review. They are retained below and have not been applied to the report.</p>
    <details><summary>Read earlier unfinished edits</summary>{items.map((item, index) => <section key={index}><h2>{titles[item.record.kind]}</h2><p>{item.reason}</p><dl>{rows(item, snapshot).map(([label, text], row) => <div key={row}><dt>{label}</dt><dd style={{ whiteSpace: "pre-wrap" }}>{text}</dd></div>)}</dl></section>)}</details>
  </aside>;
}
