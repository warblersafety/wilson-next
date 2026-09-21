/** Transient, code-owned references into the original input, never model offsets. */
export interface SourcePassage {
  reference: string;
  start: number;
  end: number;
  text: string;
}

export function sourcePassages(text: string): SourcePassage[] {
  const segments = new Intl.Segmenter("en", { granularity: "sentence" }).segment(text);
  return [...segments].filter(({ segment }) => segment.trim()).map(({ segment, index }, ordinal) => ({
    reference: `p${ordinal + 1}`,
    start: index,
    end: index + segment.length,
    text: segment,
  }));
}

export function resolveSourceReferences(text: string, references: string[]): SourcePassage[] | undefined {
  const passages = new Map(sourcePassages(text).map((passage) => [passage.reference, passage]));
  // Reject duplicate references rather than hiding an ambiguous selection.
  if (!references.length || new Set(references).size !== references.length) return undefined;
  const selected = references.map((reference) => passages.get(reference));
  if (selected.some((passage) => !passage)) return undefined;
  return (selected as SourcePassage[]).sort((a, b) => a.start - b.start);
}
