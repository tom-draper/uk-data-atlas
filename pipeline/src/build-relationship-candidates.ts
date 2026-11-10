import { isMainModule } from "./lib/entrypoint.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { buildRelationshipCandidates } from "./relationships/buildRelationshipCandidates.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildRelationshipCandidates(repositoryRoot);
	buildLog.info(
		`Wrote ${formatCount(result.candidateCount)} relationship candidates to ${repoPath(result.inventoryPath)}`,
	);
}
