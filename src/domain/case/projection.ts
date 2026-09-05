import type { Fact, ProductEntity, SemanticCase } from "./types";

export interface ProjectionOmission {
  concept: string;
  target: string;
  reason: "empty" | "unknown" | "explicitly-absent" | "inapplicable" | "declined" | "conflicted" | "unsupported";
  sourceIds: string[];
}

export interface Form3500Projection {
  revision: number;
  sections: {
    A: { patientIdentifier?: string; ageYears?: number; sex?: "female" | "male" | "intersex" };
    B: {
      eventDate?: string;
      eventDescription?: string;
      hospitalized?: boolean;
      relevantTests?: string;
    };
    D: { suspectProducts: ProjectedProduct[] };
    F: { concomitantProducts: ProjectedProduct[] };
  };
  sourceTrace: Record<string, string[]>;
  omissions: ProjectionOmission[];
  notIncluded: string[];
}

export interface ProjectedProduct {
  productId: string;
  name?: string;
  dose?: string;
  frequency?: string;
  route?: string;
  startDate?: string;
  indication?: string;
}

export function projectForm3500(caseState: SemanticCase): Form3500Projection {
  const projection: Form3500Projection = {
    revision: caseState.revision,
    sections: { A: {}, B: {}, D: { suspectProducts: [] }, F: { concomitantProducts: [] } },
    sourceTrace: {},
    omissions: [],
    notIncluded: ["Section E device products", "Section G reporter information"],
  };

  assign(projection, "sections.A.patientIdentifier", "patient identifier", "patient:patient:identifier", caseState.patient.facts.identifier, projection.sections.A, "patientIdentifier");
  assign(projection, "sections.A.ageYears", "patient age", "patient:patient:ageYears", caseState.patient.facts.ageYears, projection.sections.A, "ageYears");
  assign(projection, "sections.A.sex", "patient sex", "patient:patient:sex", caseState.patient.facts.sex, projection.sections.A, "sex");
  assign(projection, "sections.B.eventDate", "event date", "event:event:onsetDate", caseState.event.facts.onsetDate, projection.sections.B, "eventDate");
  assign(projection, "sections.B.hospitalized", "hospitalization outcome", "event:event:hospitalized", caseState.event.facts.hospitalized, projection.sections.B, "hospitalized");
  assign(projection, "sections.B.relevantTests", "relevant tests", "event:event:hemoglobin", caseState.event.facts.hemoglobin, projection.sections.B, "relevantTests");

  const eventDescription = buildEventDescription(caseState);
  if (eventDescription.value) {
    projection.sections.B.eventDescription = eventDescription.value;
    projection.sourceTrace["sections.B.eventDescription"] = eventDescription.sourceIds;
  } else {
    projection.omissions.push({ concept: "event description", target: "event:event", reason: "empty", sourceIds: [] });
  }

  for (const product of caseState.products.filter(({ state }) => state === "resolved")) {
    const role = known(product.facts.role);
    if (!role || (role.value !== "suspect" && role.value !== "concomitant")) continue;
    const target = role.value === "suspect" ? projection.sections.D.suspectProducts : projection.sections.F.concomitantProducts;
    target.push(projectProduct(product, projection, role.value === "suspect" ? "D" : "F", target.length));
  }

  return projection;
}

function projectProduct(
  product: ProductEntity,
  projection: Form3500Projection,
  section: "D" | "F",
  index: number,
): ProjectedProduct {
  const result: ProjectedProduct = { productId: product.id };
  const prefix = `sections.${section}.${section === "D" ? "suspectProducts" : "concomitantProducts"}.${index}`;
  for (const field of ["name", "dose", "frequency", "route", "startDate", "indication"] as const) {
    assign(projection, `${prefix}.${field}`, `${field} for ${product.id}`, `product:${product.id}:${field}`, product.facts[field], result, field);
  }
  return result;
}

function assign<T extends string | number | boolean>(
  projection: Form3500Projection,
  path: string,
  concept: string,
  target: string,
  fact: Fact<T>,
  output: object,
  key: string,
): void {
  const resolved = known(fact);
  if (resolved) {
    (output as Record<string, unknown>)[key] = resolved.value;
    projection.sourceTrace[path] = resolved.sourceIds;
    return;
  }
  projection.omissions.push({ concept, target, reason: omissionReason(fact), sourceIds: fact.sourceIds });
}

function known<T>(fact: Fact<T>): { value: T; sourceIds: string[] } | undefined {
  return fact.state === "resolved" && fact.resolvedValue?.value.kind === "known"
    ? { value: fact.resolvedValue.value.value, sourceIds: fact.resolvedValue.sourceIds }
    : undefined;
}

function omissionReason(fact: Fact<unknown>): ProjectionOmission["reason"] {
  if (fact.state === "conflicted") return "conflicted";
  if (!fact.resolvedValue) return "empty";
  return fact.resolvedValue.value.kind === "known" ? "empty" : fact.resolvedValue.value.kind;
}

function buildEventDescription(caseState: SemanticCase): { value?: string; sourceIds: string[] } {
  const parts: string[] = [];
  const sourceIds: string[] = [];
  const append = <T>(fact: Fact<T>, render: (value: T) => string) => {
    const value = known(fact);
    if (value) {
      parts.push(render(value.value));
      sourceIds.push(...value.sourceIds);
    }
  };
  append(caseState.event.facts.symptoms, (value) => `Symptoms: ${value.join(" and ")}.`);
  append(caseState.event.facts.treatments, (value) => `Treatment: ${value.join("; ")}.`);
  append(caseState.event.facts.outcome, (value) => `Outcome: ${value}.`);
  append(caseState.event.facts.dischargeDate, (value) => `Discharged ${value}.`);
  return { value: parts.length > 0 ? parts.join(" ") : undefined, sourceIds: [...new Set(sourceIds)] };
}
