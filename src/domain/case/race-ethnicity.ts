/** Exact combined A5 categories from the pinned official Form3500(09/2025). */
export const raceEthnicityOptions = [
  { value: "american-indian-alaska-native", label: "American Indian or Alaska Native", widget: "RaceAmInd" },
  { value: "asian", label: "Asian", widget: "RaceAsian" },
  { value: "black-african-american", label: "Black or African American", widget: "RaceBlack" },
  { value: "hispanic-latino", label: "Hispanic or Latino", widget: "EthnicLatino" },
  { value: "middle-eastern-north-african", label: "Middle Eastern or North African", widget: "RaceMiddleEastern" },
  { value: "native-hawaiian-pacific-islander", label: "Native Hawaiian or Pacific Islander", widget: "RacePacific" },
  { value: "white", label: "White", widget: "RaceWhite" },
] as const;
export type RaceEthnicity = (typeof raceEthnicityOptions)[number]["value"];
export const raceEthnicityValues = raceEthnicityOptions.map(option => option.value);
export function isRaceEthnicitySelections(value: unknown): value is RaceEthnicity[] {
  return Array.isArray(value) && value.length > 0 && value.length <= raceEthnicityOptions.length
    && new Set(value).size === value.length
    && value.every(item => typeof item === "string" && raceEthnicityValues.includes(item as RaceEthnicity));
}
