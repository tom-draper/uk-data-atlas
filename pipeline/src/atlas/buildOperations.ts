import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import { compileOperationTemplates } from "./operationTemplates.ts";
import {
	openapiDocumentHash,
	type OperationsArtifact,
} from "@uk-data-atlas/artifacts";
import { apiRootOf, artifactDirectory } from "@uk-data-atlas/atlas-db";

/**
 * Compiles the operations the server matches requests against from
 * `openapi.yaml`, so the server reads them as JSON and a parameter written in
 * any YAML style is declared.
 */
export const compileOperations = (
	openapiDocument: string,
): OperationsArtifact => ({
	schemaVersion: 1,
	inputs: { openapiDocument: openapiDocumentHash(openapiDocument) },
	operations: compileOperationTemplates(parse(openapiDocument)),
});

export const buildOperations = (repositoryRoot: string) => {
	const artifact = compileOperations(
		readFileSync(join(apiRootOf(repositoryRoot), "openapi.yaml"), "utf8"),
	);
	const outputPath = join(
		artifactDirectory(repositoryRoot),
		"operations.json",
	);
	// This is the first build step, and a fresh checkout has no `public`.
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, `${JSON.stringify(artifact, null, "\t")}\n`);
	return { outputPath, operationCount: artifact.operations.length };
};
