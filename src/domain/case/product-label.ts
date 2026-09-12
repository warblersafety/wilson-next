export function productDisplayLabel(name: string | undefined, ordinal: number): string {
  return name?.trim() || `Product ${ordinal}`;
}
