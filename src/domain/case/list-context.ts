/** Qualifier belongs to the stored list fact; never guess an item attribution. */
export function listWithContext(text: string, qualifier?: string, label = "Context for this list"): string {
  return qualifier ? `${text}. ${label}: ${qualifier}` : text;
}
