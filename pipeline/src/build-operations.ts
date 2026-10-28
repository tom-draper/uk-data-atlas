import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { compileOperationTemplates } from "./operationTemplates";
import {
	openapiDocumentHash,
	type OperationsArtifact,
} from "@uk-data-atlas/atlas-runtime/api";
import { apiRootOf, artifactRoot } from "@uk-data-atlas/atlas-runtime/storage";

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

export const buildOperations = (apiRoot: string) => {
	const artifact = compileOperations(
		readFileSync(join(apiRoot, "openapi.yaml"), "utf8"),
	);
	const outputPath = join(artifactRoot(apiRoot), "operations.json");
	// This is the first build step, and a fresh checkout has no `public`.
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, `${JSON.stringify(artifact, null, "\t")}\n`);
	return { outputPath, operationCount: artifact.operations.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const { outputPath, operationCount } = buildOperations(
		apiRootOf(resolve(dirname(scriptPath), "../..")),
	);
	console.log(`Wrote ${operationCount} operation paths to ${outputPath}`);
}
