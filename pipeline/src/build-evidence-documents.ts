import { build } from "esbuild";
import {
	measureCapability,
	measureCompatibilityReport,
	measureQuality,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readApiCatalogues } from "@uk-data-atlas/atlas-runtime/catalogue";
import { evidenceInputsHash } from "./evidence/evidenceInputsHash";
import { buildEvidenceMeasure } from "./evidence/buildEvidenceMeasure";
import { evidenceReport } from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	writeEvidenceDocument,
	cachedEvidenceMeasure,
} from "./evidence/evidenceDocumentStore";
import { availableReconciliations } from "@uk-data-atlas/atlas-runtime/catalogue";
import { publicJson } from "@uk-data-atlas/atlas-runtime/storage";
import type { RouteContext } from "@uk-data-atlas/atlas-runtime/areas";
import { apiRootOf, artifactRoot } from "@uk-data-atlas/atlas-runtime/storage";

const apiRoot = apiRootOf(resolve(import.meta.dirname, "../.."));
const directory = artifactRoot(apiRoot);
const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const report = (context: RouteContext, url: string) => {
	const parsedUrl = new URL(url, "http://localhost");
	const response = evidenceReport({
		context,
		releaseId: "build",
		parsedUrl,
		segments: parsedUrl.pathname.split("/").filter(Boolean),
		dispatch: () => {
			throw new Error("Evidence reports cannot dispatch HTTP requests");
		},
	});
	if (!response) throw new Error(`No evidence compiler for ${url}`);
	if (response.status >= 500)
		throw new Error(`${url}: ${publicJson(response.body)}`);
	return {
		status: response.status,
		data: "data" in response.body ? response.body.data : response.body,
	};
};

const write = (id: string, data: unknown) =>
	writeEvidenceDocument(directory, id, data);

const graph = await build({
	absWorkingDir: apiRoot,
	entryPoints: [fileURLToPath(import.meta.url)],
	bundle: true,
	write: false,
	metafile: true,
	platform: "node",
	format: "esm",
	target: "node24",
});
const compilerHash = sha256(
	Object.keys(graph.metafile.inputs)
		.sort()
		.map((path) => readFileSync(resolve(apiRoot, path), "utf8"))
		.join("\n"),
);

const inputsHash = (context: ReturnType<typeof readApiCatalogues>) =>
	evidenceInputsHash(directory, context);

const main = () => {
	const context = readApiCatalogues(apiRoot, {
		loadEvidenceDocuments: false,
	});
	const documents = [
		write("corrections", report(context, "/v1/corrections")),
		write("geography-health", report(context, "/v1/geography-health")),
		write(
			"relationship-repairs",
			report(context, "/v1/relationship-repairs"),
		),
	];
	const sourceHash = inputsHash(context);
	// One process builds every measure. The boundary and crosswalk loaders
	// keep what they read, so each measure after the first is mostly
	// compilation: a process per measure re-read the same files 229 times and
	// took several times the CPU for the same documents.
	for (const measure of context.dataCatalog.measures) {
		documents.push(
			cachedEvidenceMeasure(
				directory,
				measure.id,
				sourceHash,
				compilerHash,
			) ??
				buildEvidenceMeasure(context, measure.id, {
					report,
					measureQuality: (context, id) => {
						if (!context.measureCompatibilityInventory)
							throw new Error(
								"Measure compatibility is required to build evidence",
							);
						const quality = measureQuality(
							context.dataCatalog,
							context.measureCompatibilityInventory,
							id,
							context,
						);
						if (!quality)
							throw new Error(
								`No published measure quality record matches ${id}`,
							);
						return quality;
					},
					measureCompatibility: (context, id) => {
						if (!context.measureCompatibilityInventory)
							throw new Error(
								"Measure compatibility is required to build evidence",
							);
						return measureCompatibilityReport(
							context.measureCompatibilityInventory,
							id,
						);
					},
					measureCapability,
					availableReconciliations,
					write,
					compilerHash,
					inputsHash,
				}),
		);
		process.stderr.write(`Built evidence for ${measure.id}\n`);
	}
	const manifest = {
		schemaVersion: 1,
		dataCatalogHash: context.dataCatalog.contentHash,
		documents,
	};
	writeFileSync(
		join(directory, "evidence-documents.json"),
		`${JSON.stringify({ ...manifest, contentHash: sha256(JSON.stringify(manifest)) })}\n`,
	);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
