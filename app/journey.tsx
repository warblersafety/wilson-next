"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { CaseValue } from "../src/domain/case/types";
import type { FactView } from "../src/domain/case/views";
import {
  correctionAccount,
  indicationAnswer,
  openingAccount,
} from "../src/experiment/fixed-inputs";
import type { JourneyAction, JourneySnapshot } from "../src/server/journey/service";
import { requestJourneyJson } from "./browser-diagnostics";
import styles from "./page.module.css";

const stageLabels: Record<JourneySnapshot["stage"], string> = {
  describe: "Describe",
  understanding: "Check understanding",
  clarify: "Clarify",
  update: "Add an update",
  correct: "Correct and resolve",
  "output-unresolved": "Needs resolution",
  "output-resolved": "Ready to download",
};

export default function Journey() {
  const [snapshot, setSnapshot] = useState<JourneySnapshot>();
  const [opening, setOpening] = useState(openingAccount);
  const [answer, setAnswer] = useState(indicationAnswer);
  const [correction, setCorrection] = useState(correctionAccount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [boundaryNotice, setBoundaryNotice] = useState<string>();

  useEffect(() => {
    void fetchSnapshot();
  }, []);

  async function fetchSnapshot() {
    try {
      setSnapshot(await requestJourneyJson<JourneySnapshot>({}, "The temporary case could not be loaded"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The temporary case could not be loaded");
    }
  }

  async function act(action: JourneyAction) {
    setBusy(true);
    setError(undefined);
    setBoundaryNotice(undefined);
    try {
      const body = await requestJourneyJson<JourneySnapshot | { error?: string }>({
        method: "POST",
        body: action,
      }, "Wilson could not update the case");
      setSnapshot(body as JourneySnapshot);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wilson could not update the case");
    } finally {
      setBusy(false);
    }
  }

  if (!snapshot) {
    return <main className={styles.loading}><p>{error ?? "Preparing the fictional case…"}</p></main>;
  }

  const outputStage = snapshot.stage === "output-unresolved" || snapshot.stage === "output-resolved";

  return (
    <main className={styles.appShell}>
      <header className={styles.header}>
        <div>
          <span className={styles.wordmark}>Wilson</span>
          <span className={styles.experiment}>Synthetic experiment</span>
        </div>
        <span className={styles.status}>{stageLabels[snapshot.stage]}</span>
      </header>

      <aside className={styles.boundary} aria-label="Experiment boundary">
        <strong>Fictional information only.</strong> This experiment supports one fixed adverse-event journey. Do not use it for a real report.
      </aside>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {boundaryNotice && <div className={styles.notice} role="status">{boundaryNotice}</div>}
      {busy && <div className={styles.progress} role="status">Updating the reviewed case…</div>}

      {outputStage ? (
        <OutputComposition snapshot={snapshot} busy={busy} act={act} />
      ) : (
        <div className={styles.workspace}>
          <section className={styles.activeTask} aria-labelledby="task-title">
            {snapshot.stage === "describe" && (
              <>
                <p className={styles.eyebrow}>Step 1 of 7</p>
                <h1 id="task-title">Describe what happened</h1>
                <p>Use the populated fictional account. Wilson will propose case knowledge for your review; it will not accept those proposals as truth.</p>
                <label htmlFor="opening-account">Clinical account</label>
                <textarea id="opening-account" rows={13} value={opening} onChange={(event) => setOpening(event.target.value)} />
                <fieldset className={styles.reportType}>
                  <legend>Report type</legend>
                  <label><input type="radio" checked readOnly /> Adverse event</label>
                </fieldset>
                <p className={styles.hint}>You can also use your device’s built-in dictation. Wilson does not record audio.</p>
                <button disabled={busy} onClick={() => void act({ action: "submit-opening", text: opening, reportType: "adverse-event" })}>
                  {busy ? "Extracting case details…" : "Review Wilson’s understanding"}
                </button>
              </>
            )}
            {snapshot.stage === "understanding" && (
              <>
                <p className={styles.eyebrow}>Step 2 of 7</p>
                <h1 id="task-title">Check Wilson’s understanding</h1>
                <p>Review five case groups and their source evidence. Nothing shown here becomes accepted until you continue.</p>
                <Evidence excerpt={openingAccount} />
                <button disabled={busy} onClick={() => void act({ action: "accept-understanding" })}>Continue with this understanding</button>
              </>
            )}
            {snapshot.stage === "clarify" && (
              <>
                <p className={styles.eyebrow}>Step 3 of 7 · one useful question</p>
                <h1 id="task-title">{snapshot.clarification?.question}</h1>
                <p>Both products are named in one question so the answer stays clearly attributed.</p>
                <label htmlFor="indication-answer">Your answer</label>
                <textarea id="indication-answer" rows={5} value={answer} onChange={(event) => setAnswer(event.target.value)} />
                <button disabled={busy} onClick={() => void act({ action: "answer-indications", text: answer })}>Add this answer</button>
              </>
            )}
            {snapshot.stage === "update" && (
              <>
                <p className={styles.eyebrow}>Step 4 of 7</p>
                <h1 id="task-title">Add the later correction and contradiction</h1>
                <p>The current naproxen dose stays accepted until you separately approve the correction. Incompatible dates will remain unresolved.</p>
                <label htmlFor="correction-account">Clinical update</label>
                <textarea id="correction-account" rows={7} value={correction} onChange={(event) => setCorrection(event.target.value)} />
                <button disabled={busy} onClick={() => void act({ action: "submit-correction", text: correction })}>Review this update</button>
              </>
            )}
            {snapshot.stage === "correct" && (
              <CorrectionTask snapshot={snapshot} busy={busy} act={act} />
            )}
          </section>

          <section className={styles.casePanel} aria-labelledby="case-title">
            <div className={styles.panelHeading}>
              <div>
                <p className={styles.eyebrow}>{snapshot.stage === "understanding" ? "Proposed case" : "Reviewed case"}</p>
                <h2 id="case-title">Case so far</h2>
              </div>
              <span>{snapshot.stage === "understanding" ? "5 groups to review" : snapshot.review.attention.length > 0 ? `${snapshot.review.attention.length} decisions` : "Reviewed"}</span>
            </div>
            <CaseCards
              snapshot={snapshot}
              onUnsupported={(label) => setBoundaryNotice(`${label} is outside this fixed experiment. Use the later clinical-update step to review the supported correction.`)}
            />
          </section>
        </div>
      )}
    </main>
  );
}

function CorrectionTask({ snapshot, busy, act }: { snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void> }) {
  const correction = snapshot.review.attention.find(({ kind }) => kind === "correction");
  const dateProposal = snapshot.review.attention.find(({ target }) => target.endsWith(":startDate"));
  const naproxen = snapshot.understanding.products.find(({ id }) => id === "product-naproxen");
  const dose = naproxen?.facts.dose;
  return (
    <>
      <p className={styles.eyebrow}>Step 5 of 7 · decision required</p>
      <h1 id="task-title">Review the correction and date conflict</h1>
      {correction ? (
        <article className={styles.attentionCard}>
          <span className={styles.attentionLabel}>Proposed correction</span>
          <h2>Naproxen dose</h2>
          <p><s>{formatFact(dose?.resolved)}</s> → <strong>{formatFact(correction.values[0].value)}</strong></p>
          <Evidence excerpt={correction.values[0].evidence[0]} expanded />
          <button disabled={busy} onClick={() => void act({ action: "accept-dose-correction" })}>Accept 250 mg correction</button>
        </article>
      ) : (
        <article className={styles.acceptedCard}>
          <span className={styles.attentionLabel}>Correction accepted</span>
          <h2>Naproxen is now 250 mg</h2>
          <p>The earlier 500 mg value remains available in history but is no longer active.</p>
        </article>
      )}
      {dateProposal && (
        <article className={styles.attentionCard}>
          <span className={styles.attentionLabel}>Incompatible evidence</span>
          <h2>Apixaban start date</h2>
          <p>The existing note says <strong>12-Aug-2026</strong>. The medication administration record says <strong>13-Aug-2026</strong>.</p>
          <div className={styles.evidencePair}>
            <Evidence excerpt="start as 12-Aug-2026" expanded />
            <Evidence excerpt={dateProposal.values[0].evidence[0]} expanded />
          </div>
          <div className={styles.decisionActions}>
            <button disabled={busy || Boolean(correction)} onClick={() => void act({ action: "resolve-date", chosenValueId: "apixaban-start" })}>Use 12-Aug-2026</button>
            <button disabled={busy || Boolean(correction)} onClick={() => void act({ action: "resolve-date", chosenValueId: "apixaban-date-alternative" })}>Use 13-Aug-2026</button>
            <button disabled={busy || Boolean(correction)} onClick={() => void act({ action: "leave-date-unresolved" })}>Keep both dates unresolved for now</button>
          </div>
        </article>
      )}
    </>
  );
}

function OutputComposition({ snapshot, busy, act }: { snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void> }) {
  const unresolved = snapshot.stage === "output-unresolved";
  const apixaban = snapshot.understanding.products.find(({ id }) => id === "product-apixaban");
  const conflict = apixaban?.facts.startDate.conflicts;
  return (
    <div className={styles.outputWorkspace}>
      <section className={styles.outputSummary} aria-labelledby="output-title">
        <p className={styles.eyebrow}>Step {unresolved ? "6" : "7"} of 7</p>
        <h1 id="output-title">{unresolved ? "Inspect what the form can include" : "The reviewed form is ready"}</h1>

        <Summary title="Included" tone="included">
          <li>Patient TEST-57, age 57, female</li>
          <li>Melena and dizziness with hospitalization and recovery</li>
          <li>Apixaban and naproxen as separate suspect products</li>
          <li>Lisinopril as a concomitant product</li>
          <li>Naproxen 250 mg; earlier 500 mg retained only in history</li>
          {!unresolved && <li>Apixaban start date 13-Aug-2026</li>}
        </Summary>

        <Summary title="Needs resolution" tone={unresolved ? "attention" : "quiet"}>
          {unresolved ? <li>Apixaban start date is omitted until one source is selected.</li> : <li>Nothing in the fixed journey.</li>}
        </Summary>

        {unresolved && conflict && (
          <fieldset className={styles.conflictChoice}>
            <legend>Choose the apixaban start date</legend>
            {conflict.map((item) => (
              <div key={item.id} className={styles.conflictOption}>
                <strong>{formatFact(item.value)}</strong>
                <Evidence excerpt={item.evidence[0]} expanded />
                {(item.id === "apixaban-start" || item.id === "apixaban-date-alternative") && (
                  <button disabled={busy} onClick={() => void act({ action: "resolve-date", chosenValueId: item.id as "apixaban-start" | "apixaban-date-alternative" })}>Use {formatFact(item.value)}</button>
                )}
              </div>
            ))}
          </fieldset>
        )}

        <Summary title="Not included" tone="quiet">
          {snapshot.projection.notIncluded.map((item) => <li key={item}>{item}</li>)}
          <li>Stop dates remain blank because no dates were supplied.</li>
          <li>Other relevant medical history remains blank; absence was not reported.</li>
        </Summary>

        {unresolved ? (
          <button disabled title="Resolve the apixaban start-date conflict first">Download official PDF</button>
        ) : (
          <a className={styles.download} href="/api/case/pdf">Download official PDF</a>
        )}
      </section>
      <section className={styles.previewPanel} aria-labelledby="preview-title">
        <div className={styles.panelHeading}>
          <div><p className={styles.eyebrow}>Supported projection</p><h2 id="preview-title">Form FDA 3500 preview</h2></div>
          {!unresolved && <a href="/api/case/pdf?mode=preview" target="_blank" rel="noreferrer">Open PDF preview</a>}
        </div>
        <FormPreview snapshot={snapshot} unresolved={unresolved} />
      </section>
    </div>
  );
}

function FormPreview({ snapshot, unresolved }: { snapshot: JourneySnapshot; unresolved: boolean }) {
  const { A, B, D, F } = snapshot.projection.sections;
  return (
    <div className={styles.formPreview} aria-label="Form FDA 3500 preview">
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
        <PreviewField label="Report type" value="Adverse event" />
        <PreviewField label="Outcome" value={B.hospitalized ? "Hospitalization" : undefined} />
        <PreviewField label="Date of event" value={displayDate(B.eventDate)} />
        <PreviewField label="Relevant tests" value={B.relevantTests} />
        <PreviewField wide label="Describe event" value={B.eventDescription} />
      </PreviewSection>
      <PreviewSection letter="D" title="Suspect products">
        {D.suspectProducts.map((product, index) => (
          <div className={styles.previewProduct} key={product.productId}>
            <strong>#{index + 1} {product.name}</strong>
            <span>{[product.dose, product.frequency, product.route].filter(Boolean).join(" · ")}</span>
            <span>Started: {product.startDate ? displayDate(product.startDate) : unresolved && product.productId === "product-apixaban" ? "Omitted — conflicting sources" : "Not provided"}</span>
            <span>Used for: {product.indication ?? "Not provided"}</span>
          </div>
        ))}
      </PreviewSection>
      <PreviewSection letter="F" title="Other medical products">
        {F.concomitantProducts.map((product) => <PreviewField key={product.productId} label="Product" value={product.name} />)}
      </PreviewSection>
      <footer>FORM FDA 3500 (09/2025) · Supported fields preview</footer>
    </div>
  );
}

function PreviewSection({ letter, title, children }: { letter: string; title: string; children: ReactNode }) {
  return <section className={styles.previewSection}><h3><span>{letter}</span>{title}</h3><div>{children}</div></section>;
}

function PreviewField({ label, value, wide = false }: { label: string; value?: string; wide?: boolean }) {
  return <div className={wide ? styles.previewWide : undefined}><span>{label}</span><strong>{value ?? "Not provided"}</strong></div>;
}

function displayDate(value: string | undefined): string | undefined {
  return value ? formatFact({ kind: "known", value }) : undefined;
}

function Summary({ title, tone, children }: { title: string; tone: "included" | "attention" | "quiet"; children: ReactNode }) {
  return <section className={`${styles.summary} ${styles[tone]}`}><h2>{title}</h2><ul>{children}</ul></section>;
}

function CaseCards({ snapshot, onUnsupported }: { snapshot: JourneySnapshot; onUnsupported: (label: string) => void }) {
  const { understanding } = snapshot;
  if (snapshot.revision === 0) {
    return <p className={styles.emptyCase}>Your proposed case knowledge will appear here after Wilson reads the fictional account.</p>;
  }
  return (
    <div className={styles.cards}>
      <CaseCard title="Patient" facts={understanding.patient} fields={["identifier", "ageYears", "sex"]} onUnsupported={onUnsupported} />
      <CaseCard title="Event" facts={understanding.event} fields={["reportType", "symptoms", "onsetDate", "hospitalized", "hemoglobin", "treatments", "outcome", "dischargeDate"]} onUnsupported={onUnsupported} />
      {understanding.products.map((product) => {
        const role = formatFact(activeValue(product.facts.role));
        const name = formatFact(activeValue(product.facts.name));
        return (
          <CaseCard
            key={product.id}
            title={name}
            eyebrow={role === "suspect" ? "Suspect product" : "Other product"}
            facts={product.facts}
            fields={["dose", "frequency", "route", "startDate", "stopDate", "indication"]}
            onUnsupported={onUnsupported}
          />
        );
      })}
    </div>
  );
}

function CaseCard({ title, eyebrow, facts, fields, onUnsupported }: { title: string; eyebrow?: string; facts: Record<string, FactView>; fields: string[]; onUnsupported: (label: string) => void }) {
  const evidence = [...new Set(fields.flatMap((field) => facts[field]?.evidence ?? []))];
  return (
    <article className={styles.caseCard}>
      <div className={styles.cardTitle}>
        <div>{eyebrow && <span>{eyebrow}</span>}<h3>{title}</h3></div>
        <div className={styles.cardActions}>
          <button onClick={() => onUnsupported(`Changing ${title}`)}>Change</button>
          <button onClick={() => onUnsupported(`Removing ${title}`)}>Remove</button>
        </div>
      </div>
      <dl>
        {fields.map((field) => {
          const fact = facts[field];
          if (!fact) return null;
          const value = activeValue(fact);
          if (!value && fact.history.length === 0) return null;
          return (
            <div key={field}>
              <dt>{fieldLabel(field)}</dt>
              <dd>{formatFact(value)}{fact.state === "proposed" && <span className={styles.proposed}>Proposed</span>}</dd>
              {fact.history.map((history, index) => <dd key={index} className={styles.history}>Earlier: {formatFact(history.value)}</dd>)}
            </div>
          );
        })}
      </dl>
      {evidence.length > 0 && <Evidence excerpt={evidence} />}
    </article>
  );
}

function activeValue(fact: FactView | undefined): CaseValue<unknown> | undefined {
  return fact?.resolved ?? fact?.proposals[0]?.value;
}

function formatFact(value: CaseValue<unknown> | undefined): string {
  if (!value) return "Not provided";
  if (value.kind !== "known") return value.kind.replaceAll("-", " ");
  if (Array.isArray(value.value)) return value.value.join(" and ");
  if (typeof value.value === "boolean") return value.value ? "Yes" : "No";
  if (typeof value.value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.value)) {
    const [year, month, day] = value.value.split("-");
    const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
    return `${Number(day)}-${monthName}-${year}`;
  }
  return String(value.value);
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    identifier: "Identifier", ageYears: "Age", sex: "Sex", symptoms: "Symptoms", onsetDate: "Onset",
    reportType: "Report type", hospitalized: "Hospitalized", hemoglobin: "Hemoglobin", treatments: "Treatment", outcome: "Outcome",
    dischargeDate: "Discharged", dose: "Dose", frequency: "Frequency", route: "Route", startDate: "Started",
    stopDate: "Stopped date", indication: "Used for",
  };
  return labels[field] ?? field;
}

function Evidence({ excerpt, expanded = false }: { excerpt?: string | string[]; expanded?: boolean }) {
  const excerpts = (Array.isArray(excerpt) ? excerpt : [excerpt]).filter((value): value is string => Boolean(value));
  if (excerpts.length === 0) return null;
  return expanded
    ? <blockquote className={styles.evidence}><span>Source evidence</span>{excerpts.map((value) => <span key={value}>“{value}”</span>)}</blockquote>
    : <details className={styles.evidence}><summary>View source evidence</summary>{excerpts.map((value) => <blockquote key={value}>“{value}”</blockquote>)}</details>;
}
