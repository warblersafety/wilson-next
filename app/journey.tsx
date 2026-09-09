"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { CaseValue } from "../src/domain/case/types";
import type { FactView, ReviewAttentionItem } from "../src/domain/case/views";
import type { BrowserJourneyState, JourneyResponse } from "../src/server/case/browser-state";
import type { JourneyAction, JourneySnapshot } from "../src/server/journey/service";
import {
  clearJourneySession,
  JourneyRequestError,
  readStoredJourneyState,
  requestJourneyJson,
  requestJourneyPdf,
  storeJourneyState,
} from "./browser-diagnostics";
import styles from "./page.module.css";

const stageLabels: Record<JourneySnapshot["stage"], string> = {
  describe: "Describe",
  understanding: "Check understanding",
  clarify: "Clarify",
  "review-update": "Review update",
  output: "Inspect output",
};

export default function Journey() {
  const [snapshot, setSnapshot] = useState<JourneySnapshot>();
  const [browserState, setBrowserState] = useState<BrowserJourneyState>();
  const [opening, setOpening] = useState("");
  const [update, setUpdate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [boundaryNotice, setBoundaryNotice] = useState<string>();

  useEffect(() => { void loadJourney(); }, []);

  function acceptResponse(response: JourneyResponse) {
    storeJourneyState(response.state);
    setBrowserState(response.state);
    setSnapshot(response.snapshot);
  }

  async function freshJourney(notice?: string) {
    const response = await requestJourneyJson<JourneyResponse>({}, "The temporary case could not be loaded");
    acceptResponse(response);
    if (notice) setBoundaryNotice(notice);
  }

  async function loadJourney() {
    try {
      const stored = readStoredJourneyState();
      if (stored === undefined) return await freshJourney();
      try {
        const response = await requestJourneyJson<JourneyResponse>({
          method: "POST",
          body: { operation: "resume", state: stored },
        }, "The saved synthetic preview could not be resumed");
        acceptResponse(response);
        setBoundaryNotice("Restored this tab’s disposable synthetic preview state.");
      } catch (caught) {
        if (caught instanceof JourneyRequestError
          && ["incompatible-browser-state", "malformed-browser-state", "stale-browser-state"].includes(caught.code ?? "")) {
          clearJourneySession();
          await freshJourney("The saved preview state was invalid or incompatible, so Wilson started over safely.");
          return;
        }
        throw caught;
      }
    } catch (caught) {
      setError(displayError(caught, "The temporary case could not be loaded"));
    }
  }

  async function act(action: JourneyAction) {
    if (!snapshot || !browserState) return;
    setBusy(true);
    setError(undefined);
    setBoundaryNotice(undefined);
    try {
      const response = await requestJourneyJson<JourneyResponse>({
        method: "POST",
        body: { operation: "act", state: browserState, expectedRevision: snapshot.revision, action },
      }, "Wilson could not update the case");
      acceptResponse(response);
      if (action.action === "submit-update") setUpdate("");
    } catch (caught) {
      setError(displayError(caught, "Wilson could not update the case"));
    } finally {
      setBusy(false);
    }
  }

  async function resetJourney() {
    if (snapshot && snapshot.revision > 0
      && !window.confirm("Start a new synthetic case? The current tab’s case will be lost.")) return;
    setBusy(true);
    setError(undefined);
    setBoundaryNotice(undefined);
    clearJourneySession();
    setSnapshot(undefined);
    setBrowserState(undefined);
    setOpening("");
    setUpdate("");
    try {
      await freshJourney("Started a blank disposable synthetic case.");
    } catch (caught) {
      setError(displayError(caught, "The synthetic case could not be started"));
    } finally {
      setBusy(false);
    }
  }

  async function openPdf(mode: "preview" | "download") {
    if (!browserState) return;
    const previewWindow = mode === "preview" ? window.open("about:blank", "_blank") : null;
    setBusy(true);
    setError(undefined);
    try {
      const { blob, filename } = await requestJourneyPdf(browserState, mode);
      const url = URL.createObjectURL(blob);
      if (mode === "preview") {
        if (!previewWindow) throw new Error("The browser blocked the PDF preview window");
        previewWindow.document.title = "Wilson Form FDA 3500 preview";
        previewWindow.document.body.style.margin = "0";
        const embed = previewWindow.document.createElement("embed");
        embed.src = url;
        embed.type = "application/pdf";
        embed.style.width = "100vw";
        embed.style.height = "100vh";
        previewWindow.document.body.replaceChildren(embed);
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch (caught) {
      previewWindow?.close();
      setError(displayError(caught, "The official PDF could not be generated"));
    } finally {
      setBusy(false);
    }
  }

  if (!snapshot) return <main className={styles.loading}><p>{error ?? "Preparing a blank synthetic case…"}</p></main>;

  return (
    <main className={styles.appShell}>
      <header className={styles.header}>
        <div><span className={styles.wordmark}>Wilson</span><span className={styles.experiment}>Synthetic experiment</span></div>
        <div className={styles.headerActions}>
          <span className={styles.status}>{stageLabels[snapshot.stage]}</span>
          <button disabled={busy} onClick={() => void resetJourney()}>New case</button>
        </div>
      </header>
      <aside className={styles.boundary} aria-label="Experiment boundary">
        <strong>Fictional information only.</strong> This disposable operator preview supports a bounded set of adult medication adverse-event facts. Do not use it for a real report or as a production system. Closing this tab or starting a new case clears its saved case.
      </aside>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {boundaryNotice && <div className={styles.notice} role="status">{boundaryNotice}</div>}
      {busy && <div className={styles.progress} role="status">Updating the reviewed case…</div>}
      {snapshot.stage === "output" ? (
        <OutputComposition snapshot={snapshot} update={update} setUpdate={setUpdate} busy={busy} act={act} openPdf={openPdf} />
      ) : (
        <div className={styles.workspace}>
          <section className={styles.activeTask} aria-labelledby="task-title">
            {snapshot.stage === "describe" && <Describe opening={opening} setOpening={setOpening} busy={busy} act={act} />}
            {snapshot.stage === "understanding" && <UnderstandingTask snapshot={snapshot} busy={busy} act={act} />}
            {snapshot.stage === "clarify" && <IndicationTask snapshot={snapshot} busy={busy} act={act} />}
            {snapshot.stage === "review-update" && <UpdateReview snapshot={snapshot} busy={busy} act={act} />}
          </section>
          <section className={styles.casePanel} aria-labelledby="case-title">
            <div className={styles.panelHeading}>
              <div><p className={styles.eyebrow}>{snapshot.stage === "understanding" ? "Proposed case" : "Reviewed case"}</p><h2 id="case-title">Case so far</h2></div>
              <span>{snapshot.review.attention.length > 0 ? `${snapshot.review.attention.length} items need review` : "Reviewed"}</span>
            </div>
            <CaseCards snapshot={snapshot} busy={busy} act={act} />
          </section>
        </div>
      )}
    </main>
  );
}

function Describe({ opening, setOpening, busy, act }: {
  opening: string; setOpening: (value: string) => void; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  return <>
    <p className={styles.eyebrow}>Describe</p>
    <h1 id="task-title">Describe what happened</h1>
    <p>Paste or type a fictional clinical account. Wilson will propose case knowledge for review; it will not accept those proposals as truth.</p>
    <label htmlFor="opening-account">Clinical account</label>
    <textarea id="opening-account" rows={13} value={opening} onChange={(event) => setOpening(event.target.value)} />
    <fieldset className={styles.reportType}><legend>Report type</legend><label><input type="radio" checked readOnly /> Adverse event</label></fieldset>
    <p className={styles.hint}>You can also use device-native dictation. Wilson does not record audio.</p>
    <button disabled={busy || !opening.trim()} onClick={() => void act({ action: "submit-opening", text: opening, reportType: "adverse-event" })}>
      {busy ? "Extracting case details…" : "Review Wilson’s understanding"}
    </button>
  </>;
}

function UnderstandingTask({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  return <>
    <p className={styles.eyebrow}>Check understanding</p>
    <h1 id="task-title">Check Wilson’s understanding</h1>
    <p>Review the proposed groups and their source evidence. Change a supported value or remove a product before accepting the remaining proposals.</p>
    <button disabled={busy} onClick={() => void act({ action: "accept-understanding" })}>Accept the remaining understanding</button>
  </>;
}

type IndicationChoice = "known" | "unknown" | "declined";

function IndicationTask({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  const productIds = snapshot.clarification?.productIds ?? [];
  const [choices, setChoices] = useState<Record<string, IndicationChoice>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const products = productIds.map((id) => snapshot.understanding.products.find((product) => product.id === id)).filter(Boolean);
  const complete = products.every((product) => {
    const choice = choices[product!.id];
    return choice === "unknown" || choice === "declined" || (choice === "known" && Boolean(texts[product!.id]?.trim()));
  });
  return <>
    <p className={styles.eyebrow}>Clarify · one useful question</p>
    <h1 id="task-title">{snapshot.clarification?.question}</h1>
    <p>Answer each labelled product separately, or record that the information is unknown or declined.</p>
    {products.map((product) => {
      const name = formatFact(activeValue(product!.facts.name));
      return <fieldset className={styles.answerGroup} key={product!.id}>
        <legend>{name}</legend>
        <label><input type="radio" name={`choice-${product!.id}`} checked={choices[product!.id] === "known"} onChange={() => setChoices({ ...choices, [product!.id]: "known" })} /> Known</label>
        <input aria-label={`${name} indication`} value={texts[product!.id] ?? ""} onChange={(event) => { setChoices({ ...choices, [product!.id]: "known" }); setTexts({ ...texts, [product!.id]: event.target.value }); }} />
        <label><input type="radio" name={`choice-${product!.id}`} checked={choices[product!.id] === "unknown"} onChange={() => setChoices({ ...choices, [product!.id]: "unknown" })} /> Unknown</label>
        <label><input type="radio" name={`choice-${product!.id}`} checked={choices[product!.id] === "declined"} onChange={() => setChoices({ ...choices, [product!.id]: "declined" })} /> Prefer not to answer</label>
      </fieldset>;
    })}
    <button disabled={busy || !complete} onClick={() => void act({
      action: "answer-indications",
      answers: products.map((product) => ({
        productId: product!.id,
        value: choices[product!.id] === "known"
          ? { kind: "known", value: texts[product!.id].trim() }
          : { kind: choices[product!.id] as "unknown" | "declined" },
      })),
    })}>Add these answers</button>
  </>;
}

function UpdateReview({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  const groups = groupAttention(snapshot.review.attention.filter(({ kind }) => kind !== "conflict"));
  return <>
    <p className={styles.eyebrow}>Review update</p>
    <h1 id="task-title">Review the proposed update</h1>
    <p>Accepted knowledge stays active until you accept a correction. An accepted incompatible alternative remains visibly unresolved and is omitted from the form.</p>
    {groups.map(({ groupId, items }) => <article className={styles.attentionCard} key={groupId}>
      <span className={styles.attentionLabel}>{items.some(({ kind }) => kind === "correction") ? "Proposed correction" : "Proposed information"}</span>
      {items.map((item) => <div key={item.target}>
        <h2>{targetLabel(snapshot, item.target)}</h2>
        <p><strong>{formatFact(item.values[0]?.value)}</strong></p>
        <Evidence excerpt={item.values[0]?.evidence} expanded />
      </div>)}
      <div className={styles.decisionActions}>
        <button disabled={busy} onClick={() => void act({ action: "review-update-group", groupId, decision: "accept" })}>Accept this update</button>
        <button disabled={busy} onClick={() => void act({ action: "review-update-group", groupId, decision: "reject" })}>Reject this update</button>
      </div>
    </article>)}
  </>;
}

function OutputComposition({ snapshot, update, setUpdate, busy, act, openPdf }: {
  snapshot: JourneySnapshot;
  update: string;
  setUpdate: (value: string) => void;
  busy: boolean;
  act: (action: JourneyAction) => Promise<void>;
  openPdf: (mode: "preview" | "download") => Promise<void>;
}) {
  const { A, B, D, F } = snapshot.projection.sections;
  const conflicts = snapshot.review.attention.filter(({ kind }) => kind === "conflict");
  return <div className={styles.outputWorkspace}>
    <section className={styles.outputSummary} aria-labelledby="output-title">
      <p className={styles.eyebrow}>Reviewed case and supported output</p>
      <h1 id="output-title">{snapshot.downloadReady ? "The supported form is ready" : "The form needs more reviewed information"}</h1>
      <Summary title="Included" tone="included">
        <li>Patient {A.patientIdentifier ?? "identifier not provided"}{A.ageYears === undefined ? "" : `, age ${A.ageYears}`}{A.sex ? `, ${A.sex}` : ""}</li>
        {B.eventDescription && <li>{B.eventDescription}</li>}
        {D.suspectProducts.map((product) => <li key={product.productId}>{product.name ?? "Unnamed product"} as a suspect product{product.dose ? `, ${product.dose}` : ""}</li>)}
        {F.concomitantProducts.map((product) => <li key={product.productId}>{product.name ?? "Unnamed product"} as another medical product</li>)}
      </Summary>

      <Summary title="Needs attention" tone={conflicts.length > 0 ? "attention" : "quiet"}>
        {conflicts.length === 0 ? <li>No unresolved conflicts.</li> : conflicts.map((conflict) => (
          <li key={conflict.target}>{targetLabel(snapshot, conflict.target)} has incompatible sources and is omitted unless you resolve it.</li>
        ))}
      </Summary>
      {conflicts.map((conflict) => <ConflictCard key={conflict.target} snapshot={snapshot} item={conflict} busy={busy} act={act} />)}

      <Summary title="Omitted or unsupported" tone="quiet">
        {snapshot.projection.omissions.map((item, index) => <li key={`${item.target}-${index}`}>{humanOmission(snapshot, item.target, item.concept)}: {omissionLabel(item.reason)}</li>)}
        {snapshot.projection.notIncluded.map((item) => <li key={item}>{item}</li>)}
      </Summary>
      {snapshot.outputIssues.length > 0 && <Summary title="Required before output" tone="attention">
        {snapshot.outputIssues.map((issue) => <li key={issue}>{issue}</li>)}
      </Summary>}

      <div className={styles.decisionActions}>
        <button disabled={busy || !snapshot.downloadReady} onClick={() => void openPdf("preview")}>Open PDF preview</button>
        <button className={styles.download} disabled={busy || !snapshot.downloadReady} onClick={() => void openPdf("download")}>Download official PDF</button>
      </div>

      <section className={styles.updateBox} aria-labelledby="update-title">
        <h2 id="update-title">Add a correction or later update</h2>
        <p>Wilson will propose changes against the reviewed product identities. Existing facts remain active until you accept an update.</p>
        <label htmlFor="later-update">Clinical update</label>
        <textarea id="later-update" rows={5} value={update} onChange={(event) => setUpdate(event.target.value)} />
        <button disabled={busy || !update.trim()} onClick={() => void act({ action: "submit-update", text: update })}>Review this update</button>
      </section>

      <h2 className={styles.reviewedHeading}>Reviewed knowledge</h2>
      <CaseCards snapshot={snapshot} busy={busy} act={act} />
    </section>
    <section className={styles.previewPanel} aria-labelledby="preview-title">
      <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Same case revision</p><h2 id="preview-title">Form FDA 3500 preview</h2></div></div>
      <FormPreview snapshot={snapshot} />
    </section>
  </div>;
}

function ConflictCard({ snapshot, item, busy, act }: {
  snapshot: JourneySnapshot; item: ReviewAttentionItem; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  return <fieldset className={styles.conflictChoice}>
    <legend>{targetLabel(snapshot, item.target)}</legend>
    {item.values.map((value) => <div className={styles.conflictOption} key={value.id}>
      <strong>{formatFact(value.value)}</strong>
      <Evidence excerpt={value.evidence} expanded />
      <button disabled={busy} onClick={() => void act({ action: "resolve-conflict", target: item.target, chosenValueId: value.id })}>Use {formatFact(value.value)}</button>
    </div>)}
    <p className={styles.hint}>You may leave this unresolved. Neither alternative will be put in the form.</p>
  </fieldset>;
}

function FormPreview({ snapshot }: { snapshot: JourneySnapshot }) {
  const { A, B, D, F } = snapshot.projection.sections;
  const omissionByTarget = new Map(snapshot.projection.omissions.map((item) => [item.target, item.reason]));
  return <div className={styles.formPreview} aria-label="Form FDA 3500 preview">
    <header className={styles.formHeader}>
      <div><strong>MedWatch</strong><span>The FDA Safety Information and Adverse Event Reporting Program</span></div>
      <div><strong>Form FDA 3500</strong><span>Voluntary Reporting</span></div>
    </header>
    <PreviewSection letter="A" title="Patient information">
      <PreviewField label="Patient identifier" value={A.patientIdentifier} />
      <PreviewField label="Age" value={A.ageYears === undefined ? undefined : `${A.ageYears} years`} />
      <PreviewField label="Sex" value={A.sex} />
    </PreviewSection>
    <PreviewSection letter="B" title="Adverse event">
      <PreviewField label="Report type" value={B.reportType === "adverse-event" ? "Adverse event" : undefined} />
      <PreviewField label="Outcome" value={B.hospitalized === undefined ? undefined : B.hospitalized ? "Hospitalization" : "Not hospitalized"} />
      <PreviewField label="Date of event" value={displayDate(B.eventDate)} />
      <PreviewField label="Relevant tests" value={B.relevantTests} />
      <PreviewField wide label="Describe event" value={B.eventDescription} />
    </PreviewSection>
    <PreviewSection letter="D" title="Suspect products">
      {D.suspectProducts.map((product, index) => <div className={styles.previewProduct} key={product.productId}>
        <strong>#{index + 1} {product.name}</strong>
        <span>{[product.dose, product.frequency, product.route].filter(Boolean).join(" · ") || "Regimen not provided"}</span>
        <span>Started: {product.startDate ? displayDate(product.startDate) : omissionText(omissionByTarget.get(`product:${product.productId}:startDate`))}</span>
        <span>Used for: {product.indication ?? omissionText(omissionByTarget.get(`product:${product.productId}:indication`))}</span>
      </div>)}
    </PreviewSection>
    <PreviewSection letter="F" title="Other medical products">
      {F.concomitantProducts.length === 0 ? <PreviewField label="Product" /> : F.concomitantProducts.map((product) => <PreviewField key={product.productId} label="Product" value={product.name} />)}
    </PreviewSection>
    <footer>FORM FDA 3500 (09/2025) · Supported fields preview</footer>
  </div>;
}

function PreviewSection({ letter, title, children }: { letter: string; title: string; children: ReactNode }) {
  return <section className={styles.previewSection}><h3><span>{letter}</span>{title}</h3><div>{children}</div></section>;
}

function PreviewField({ label, value, wide = false }: { label: string; value?: string; wide?: boolean }) {
  return <div className={wide ? styles.previewWide : undefined}><span>{label}</span><strong>{value ?? "Not provided"}</strong></div>;
}

function Summary({ title, tone, children }: { title: string; tone: "included" | "attention" | "quiet"; children: ReactNode }) {
  return <section className={`${styles.summary} ${styles[tone]}`}><h2>{title}</h2><ul>{children}</ul></section>;
}

function CaseCards({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  const understanding = snapshot.understanding;
  if (snapshot.revision === 0) return <p className={styles.emptyCase}>Proposed case knowledge will appear here after Wilson reads the account.</p>;
  return <div className={styles.cards}>
    <CaseCard title="Patient" groupId="patient" facts={understanding.patient} fields={["identifier", "ageYears", "sex"]} allowChanges={snapshot.stage === "understanding"} busy={busy} act={act} />
    <CaseCard title="Event" groupId="event" facts={understanding.event} fields={["reportType", "symptoms", "onsetDate", "hospitalized", "hemoglobin", "treatments", "outcome", "dischargeDate"]} allowChanges={snapshot.stage === "understanding"} busy={busy} act={act} />
    {understanding.products.map((product) => {
      const name = formatFact(activeValue(product.facts.name));
      const role = formatFact(activeValue(product.facts.role));
      return <CaseCard key={product.id} title={name} eyebrow={role === "suspect" ? "Suspect product" : "Other product"} groupId={product.proposalGroupId} facts={product.facts} fields={["dose", "frequency", "route", "startDate", "stopped", "stopDate", "indication"]} evidenceFields={["name", "role"]} allowChanges={snapshot.stage === "understanding" && product.state === "proposed"} allowRemove={snapshot.stage === "understanding" && product.state === "proposed"} busy={busy} act={act} />;
    })}
  </div>;
}

function CaseCard({ title, eyebrow, groupId, facts, fields, evidenceFields = [], allowChanges, allowRemove = false, busy, act }: {
  title: string;
  eyebrow?: string;
  groupId: string;
  facts: Record<string, FactView>;
  fields: string[];
  evidenceFields?: string[];
  allowChanges: boolean;
  allowRemove?: boolean;
  busy: boolean;
  act: (action: JourneyAction) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string>();
  const [replacement, setReplacement] = useState("");
  const evidence = [...new Set([...fields, ...evidenceFields].flatMap((field) => facts[field]?.evidence ?? []))];
  return <article className={styles.caseCard}>
    <div className={styles.cardTitle}>
      <div>{eyebrow && <span>{eyebrow}</span>}<h3>{title}</h3></div>
      {allowRemove && <div className={styles.cardActions}><button disabled={busy} onClick={() => void act({ action: "reject-group", groupId })}>Remove {title}</button></div>}
    </div>
    <dl>{fields.map((field) => {
      const fact = facts[field];
      if (!fact) return null;
      const value = activeValue(fact);
      if (!value && fact.history.length === 0 && fact.conflicts.length === 0) return null;
      const proposal = fact.proposals.find(({ groupId: proposalGroup }) => proposalGroup === groupId);
      const editable = allowChanges && proposal?.value.kind === "known" && !Array.isArray(proposal.value.value);
      return <div key={field}>
        <dt>{fieldLabel(field)}</dt>
        <dd>{fact.state === "conflicted" ? "Unresolved conflict" : formatFact(value)}{fact.state === "proposed" && <span className={styles.proposed}>Proposed</span>}</dd>
        {fact.history.map((history, index) => <dd key={index} className={styles.history}>Earlier: {formatFact(history.value)}</dd>)}
        {editable && editing !== field && <button className={styles.inlineAction} disabled={busy} onClick={() => { setEditing(field); setReplacement(String(proposal.value.kind === "known" ? proposal.value.value : "")); }}>Change</button>}
        {editable && editing === field && <div className={styles.inlineEdit}>
          <input aria-label={`New ${fieldLabel(field)}`} value={replacement} onChange={(event) => setReplacement(event.target.value)} />
          <button disabled={busy || !replacement.trim()} onClick={() => {
            const replacementValue = replacementFor(proposal.value, replacement);
            void act({ action: "change-proposal", groupId, proposalId: proposal.id, value: replacementValue, statement: `${fieldLabel(field)} corrected to ${replacement}.` });
            setEditing(undefined);
          }}>Apply change</button>
        </div>}
      </div>;
    })}</dl>
    {evidence.length > 0 && <Evidence excerpt={evidence} />}
  </article>;
}

function groupAttention(items: ReviewAttentionItem[]) {
  const groups = new Map<string, ReviewAttentionItem[]>();
  for (const item of items) {
    if (!item.groupId) continue;
    groups.set(item.groupId, [...(groups.get(item.groupId) ?? []), item]);
  }
  return [...groups].map(([groupId, grouped]) => ({ groupId, items: grouped }));
}

function replacementFor(original: CaseValue<unknown>, replacement: string): CaseValue<unknown> {
  if (original.kind !== "known") return { kind: "known", value: replacement };
  if (typeof original.value === "number") return { kind: "known", value: Number(replacement) };
  if (typeof original.value === "boolean") return { kind: "known", value: replacement.toLowerCase() === "yes" || replacement.toLowerCase() === "true" };
  return { kind: "known", value: replacement };
}

function activeValue(fact: FactView | undefined): CaseValue<unknown> | undefined {
  return fact?.resolved ?? fact?.proposals[0]?.value;
}

function formatFact(value: CaseValue<unknown> | undefined): string {
  if (!value) return "Not provided";
  if (value.kind !== "known") return value.kind.replaceAll("-", " ");
  if (Array.isArray(value.value)) return value.value.join(" and ");
  if (typeof value.value === "boolean") return value.value ? "Yes" : "No";
  if (typeof value.value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.value)) return displayDate(value.value) ?? value.value;
  return String(value.value);
}

function displayDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-");
  const name = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
  return `${Number(day)}-${name}-${year}`;
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    identifier: "Identifier", ageYears: "Age", sex: "Sex", symptoms: "Symptoms", onsetDate: "Onset",
    reportType: "Report type", hospitalized: "Hospitalized", hemoglobin: "Hemoglobin", treatments: "Treatment", outcome: "Outcome",
    dischargeDate: "Discharged", dose: "Dose", frequency: "Frequency", route: "Route", startDate: "Started",
    stopped: "Stopped", stopDate: "Stopped date", indication: "Used for", name: "Name", role: "Role",
  };
  return labels[field] ?? field;
}

function targetLabel(snapshot: JourneySnapshot, target: string): string {
  const [entity, entityId, field] = target.split(":");
  if (entity !== "product") return field ? fieldLabel(field) : target;
  const product = snapshot.understanding.products.find(({ id }) => id === entityId);
  return `${formatFact(activeValue(product?.facts.name))} — ${fieldLabel(field ?? "")}`;
}

function omissionLabel(reason: string): string {
  return reason === "empty" ? "not provided" : reason.replaceAll("-", " ");
}

function omissionText(reason: string | undefined): string {
  return reason === "conflicted" ? "Omitted — unresolved conflict" : reason ? omissionLabel(reason) : "Not provided";
}

function humanOmission(snapshot: JourneySnapshot, target: string, fallback: string): string {
  const [entity] = target.split(":");
  return entity === "product" || target.includes(":") ? targetLabel(snapshot, target) : fallback;
}

function Evidence({ excerpt, expanded = false }: { excerpt?: string | string[]; expanded?: boolean }) {
  const excerpts = (Array.isArray(excerpt) ? excerpt : [excerpt]).filter((value): value is string => Boolean(value));
  if (excerpts.length === 0) return null;
  return expanded
    ? <blockquote className={styles.evidence}><span>Source evidence</span>{excerpts.map((value) => <span key={value}>“{value}”</span>)}</blockquote>
    : <details className={styles.evidence}><summary>View source evidence</summary>{excerpts.map((value) => <blockquote key={value}>“{value}”</blockquote>)}</details>;
}

function displayError(caught: unknown, fallback: string): string {
  if (!(caught instanceof Error)) return fallback;
  if (caught instanceof JourneyRequestError && caught.diagnosticReference) return `${caught.message} Diagnostic reference: ${caught.diagnosticReference}`;
  return caught.message;
}
