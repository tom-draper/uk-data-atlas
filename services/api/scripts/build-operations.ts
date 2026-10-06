import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import {
	compileOperationTemplates,
	openapiDocumentHash,
	type OperationsArtifact,
} from "../src/operationTemplates";

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
	const outputPath = join(apiRoot, "public", "operations.json");
	writeFileSync(outputPath, `${JSON.stringify(artifact, null, "\t")}\n`);
	return { outputPath, operationCount: artifact.operations.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const { outputPath, operationCount } = buildOperations(
		resolve(dirname(scriptPath), ".."),
	);
	console.log(`Wrote ${operationCount} operation paths to ${outputPath}`);
}
