import {isSuppliedDate} from "../../domain/case/date-precision";
import { seriousOutcomeFields } from "../../domain/case/serious-outcomes";
import { z } from "zod";

export { seriousOutcomeFields };

export type SeriousOutcomeField = typeof seriousOutcomeFields[number];

const caseValueSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("known"),
    value: z.union([
      z.object({precision:z.enum(["month","year"]),year:z.string(),month:z.string().optional(),wording:z.string()}).strict(),
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.object({ value: z.number().positive(), unit: z.enum(["kg", "lb"]) }).strict(), z.object({ value: z.number(), unit: z.enum(["months", "weeks", "days"]) }).strict(), z.object({ value: z.string(), unit: z.string() }).strict(),
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

const medicationBooleanSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("known"), value: z.boolean() }).strict(),
  z.object({ kind: z.literal("unknown") }).strict(),
  z.object({ kind: z.literal("declined") }).strict(),
]);
const medicationDateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("known"), value: z.union([z.string(),z.object({precision:z.enum(["month","year"]),year:z.string(),month:z.string().optional(),wording:z.string()}).strict()]).refine(isSuppliedDate), qualifier:z.string().optional() }).strict(),
  z.object({ kind: z.literal("unknown") }).strict(),
  z.object({ kind: z.literal("declined") }).strict(),
]);

const deviceDateSchema=z.union([medicationDateSchema,z.object({kind:z.literal("inapplicable")}).strict()]);

export const journeyActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit-opening"),
    text: z.string(),
    reportType: z.enum(["adverse-event", "product-problem", "adverse-event-and-product-problem"]),
  }).strict(),
  z.object({
    action: z.literal("review-opening-group"),
    groupId: z.string().min(1),
    corrections: z.array(z.object({
      proposalId: z.string().min(1),
      value: caseValueSchema,
    }).strict()),
  }).strict(),
  z.object({ action: z.literal("reject-group"), groupId: z.string().min(1) }).strict(),
  z.object({ action: z.literal("accept-understanding") }).strict(),
  z.object({
    action: z.literal("set-fact"),
    target: z.string().min(1),
    value: caseValueSchema,
  }).strict(),
  z.object({
    action: z.literal("withdraw-entity"),
    entity: z.enum(["product", "test"]),
    entityId: z.string().min(1),
  }).strict(),
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
  z.object({ action: z.literal("answer-death-date"), value: z.union([medicationDateSchema,z.object({kind:z.literal("explicitly-absent")}).strict()]) }).strict(),
  z.object({
    action: z.literal("answer-clinical-context"),
    test: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("known"),
        testName: z.string().trim().min(1).optional(),
        testResult: z.string().trim().min(1).optional(),
        lowRange: z.string().trim().optional(),
        highRange: z.string().trim().optional(),
        date: z.union([z.string(),z.object({precision:z.enum(["month","year"]),year:z.string(),month:z.string().optional(),wording:z.string()}).strict()]).refine(isSuppliedDate).optional(),
      }).strict().refine((test) => Boolean(test.testName || test.testResult), "A test identity or result is required"),
      z.object({ kind: z.literal("explicitly-absent") }).strict(),
      z.object({ kind: z.literal("unknown") }).strict(),
      z.object({ kind: z.literal("declined") }).strict(),
    ]).optional(),
    history: answerStringSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal("answer-medication-history"),
    productId: z.string().min(1),
    answers: z.object({
      stopped: medicationBooleanSchema.optional(), doseReduced: medicationBooleanSchema.optional(),
      stopDate: medicationDateSchema.optional(), improvedAfterChange: medicationBooleanSchema.optional(),
      restarted: medicationBooleanSchema.optional(), recurred: medicationBooleanSchema.optional(),
    }).strict(),
  }).strict(),
  z.object({
    action: z.literal("answer-device-details"),
    implantDate: deviceDateSchema.optional(),
    explantDate: deviceDateSchema.optional(),
    reprocessor: deviceAnswerStringSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal("answer-reporter"),
    reportDate: z.iso.date().nullable().optional(),
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
    dateCorrections: z.array(z.object({proposalId:z.string().min(1),value:caseValueSchema}).strict()).optional(),
  }).strict(),
  z.object({
    action: z.literal("resolve-conflict"),
    target: z.string().min(1),
    chosenValueId: z.string().min(1),
    dateCorrection: caseValueSchema.optional(),
  }).strict(),
]);

export type JourneyAction = z.infer<typeof journeyActionSchema>;
