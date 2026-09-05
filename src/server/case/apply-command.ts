import { applyCaseCommand } from "../../domain/case/commands";
import type { CaseCommand, SemanticCase } from "../../domain/case/types";
import type { CaseRepository } from "./repository";

export async function applyCaseCommandToRepository(
  repository: CaseRepository,
  caseId: string,
  command: CaseCommand,
): Promise<SemanticCase> {
  const current = await repository.load(caseId);
  if (!current) throw new Error(`Case ${caseId} does not exist`);
  const result = applyCaseCommand(current, command);
  if (result.applied) await repository.save(result.case, current.revision);
  return result.case;
}
