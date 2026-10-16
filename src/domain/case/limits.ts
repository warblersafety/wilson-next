export const maximumCaseProducts = 3;
export const maximumRelevantTests = 8;
// Five ordinary groups + up to six medication groups, with three correction
// rounds across three products and four entries of headroom. Not a question quota.
export const maximumAskedNeeds = 24;

// Bounded Form 3500 output capacity, distinct from retained case capacity.
export const nativeForm3500SuspectSlots = 2;
export const maximumForm3500SuspectProducts = 3;
/** Extra D-only copies use the first original native block. */
export const form3500SuspectSlot = (index: number): 0 | 1 => index === 1 ? 1 : 0;
export const maximumForm3500ConcomitantProducts = 1;
