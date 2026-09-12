import type { ProductFactKey } from "../src/domain/case/types";
import type { FactView } from "../src/domain/case/views";

export const productIdentityFields = ["name", "productType", "role"] as const satisfies readonly ProductFactKey[];

export const nonDeviceProductFields = [
  "manufacturer", "lotNumber", "dose", "frequency", "route", "startDate", "stopped", "stopDate", "indication",
] as const satisfies readonly ProductFactKey[];

export const deviceProductFields = [
  "commonName", "manufacturer", "procode", "modelNumber", "lotNumber", "catalogNumber", "expirationDate",
  "serialNumber", "udi", "deviceOperator", "stopped", "implanted", "implantDate", "explantDate",
  "reprocessedSingleUse", "reprocessor", "servicedByThirdParty",
] as const satisfies readonly ProductFactKey[];

export const productCardFieldUniverse = unique([
  ...productIdentityFields,
  ...nonDeviceProductFields,
  ...deviceProductFields,
]);

export function productCardFields(
  productType: string | undefined,
  facts: Record<string, FactView>,
): ProductFactKey[] {
  const primary = productType === "device" ? deviceProductFields
    : productType === "drug-or-biologic" || productType === "other" ? nonDeviceProductFields
      : [];
  const retained = productCardFieldUniverse.filter((field) => hasKnowledge(facts[field]));
  return unique([...productIdentityFields, ...primary, ...retained]);
}

function hasKnowledge(fact: FactView | undefined): boolean {
  return Boolean(fact && (fact.state !== "empty" || fact.history.length > 0));
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
