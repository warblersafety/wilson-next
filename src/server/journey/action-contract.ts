import { z } from "zod";

export const seriousOutcomeFields = [
  "death",
  "lifeThreatening",
  "hospitalized",
  "disability",
  "requiredIntervention",
  "congenitalAnomaly",
  "otherSerious",
] as const;

export type SeriousOutcomeField = typeof seriousOutcomeFields[number];

const caseValueSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("known"),
    value: z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.object({ value: z.number().positive(), unit: z.enum(["kg", "lb"]) }).strict(),
    ]),
    qualifier: z.string().optional(),
  }).strict(),
  z.object({ kind: z.literal("unknown") }).strict(),
  z.object({ kind: z.literal("explicitly-absent") }).strict(),
  z.object({ kind: z.literal("inapplicable") }).strict(),
  z.object({ kind: z.literal("declined") }).strict(),
]);

const indicationValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("known"), value: z.string().trim().min(1) }).strict(),
  z.object({ kind: z.literal("unknown") }).strict(),
  z.object({ kind: z.literal("declined") }).strict(),
]);

const answerStringSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("known"), value: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("unknown") }).strict(),
  z.object({ kind: z.literal("explicitly-absent") }).strict(),
  z.object({ kind: z.literal("declined") }).strict(),
]);

const deviceAnswerStringSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("known"), value: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("unknown") }).strict(),
  z.object({ kind: z.literal("inapplicable") }).strict(),
  z.object({ kind: z.literal("declined") }).strict(),
]);

export const journeyActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit-opening"),
    text: z.string(),
    reportType: z.enum(["adverse-event", "product-problem", "adverse-event-and-product-problem"]),
  }).strict(),
  z.object({
    action: z.literal("change-proposal"),
    groupId: z.string().min(1),
    proposalId: z.string().min(1),
    value: caseValueSchema,
    statement: z.string().min(1),
  }).strict(),
  z.object({ action: z.literal("reject-group"), groupId: z.string().min(1) }).strict(),
  z.object({ action: z.literal("accept-understanding") }).strict(),
  z.object({
    action: z.literal("answer-indications"),
    answers: z.array(z.object({
      productId: z.string().min(1),
      value: indicationValueSchema,
    }).strict()).min(1),
  }).strict(),
  z.object({
    action: z.literal("answer-serious-outcomes"),
    selected: z.array(z.enum(seriousOutcomeFields)),
    disposition: z.enum(["known", "unknown", "declined"]),
  }).strict(),
  z.object({ action: z.literal("answer-death-date"), value: answerStringSchema }).strict(),
  z.object({
    action: z.literal("answer-clinical-context"),
    test: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("known"),
        testResult: z.string().trim().min(1),
        lowRange: z.string().trim().optional(),
        highRange: z.string().trim().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }).strict(),
      z.object({ kind: z.literal("explicitly-absent") }).strict(),
      z.object({ kind: z.literal("unknown") }).strict(),
      z.object({ kind: z.literal("declined") }).strict(),
    ]).optional(),
    history: answerStringSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal("answer-device-details"),
    implantDate: deviceAnswerStringSchema.optional(),
    explantDate: deviceAnswerStringSchema.optional(),
    reprocessor: deviceAnswerStringSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal("answer-reporter"),
    reporter: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("declined") }).strict(),
      z.object({
        kind: z.literal("provided"),
        lastName: z.string().trim().min(1),
        firstName: z.string().trim().min(1),
        address: z.string().trim().optional(),
        city: z.string().trim().optional(),
        state: z.string().trim().optional(),
        postalCode: z.string().trim().optional(),
        country: z.string().trim().optional(),
        phone: z.string().trim().optional(),
        email: z.string().trim().optional(),
        healthProfessional: z.boolean(),
        occupation: z.string().trim().min(1),
        reportedTo: z.array(z.enum(["manufacturer", "user-facility", "distributor-importer", "packer"])),
        doNotDiscloseIdentity: z.boolean(),
      }).strict(),
    ]),
  }).strict(),
  z.object({ action: z.literal("submit-update"), text: z.string().min(1) }).strict(),
  z.object({
    action: z.literal("review-update-group"),
    groupId: z.string().min(1),
    decision: z.enum(["accept", "reject"]),
  }).strict(),
  z.object({
    action: z.literal("resolve-conflict"),
    target: z.string().min(1),
    chosenValueId: z.string().min(1),
  }).strict(),
]);

export type JourneyAction = z.infer<typeof journeyActionSchema>;
