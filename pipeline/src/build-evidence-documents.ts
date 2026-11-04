import { build } from "esbuild";
import {
	correctionsReport,
	geographyHealthReport,
	measureCapability,
	measureCompatibilityReport,
	measureCoverage,
	measureQuality,
	relationshipRepairsReport,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readAtlasCatalogues } from "@uk-data-atlas/atlas-runtime/catalogue";
import { evidenceInputsHash } from "./evidence/evidenceInputsHash.ts";
import { buildEvidenceMeasure } from "./evidence/buildEvidenceMeasure.ts";
import {
	coveragePlanEvidence,
	reconciliationEvidence,
} from "./evidence/measureReports.ts";
import {
	writeEvidenceDocument,
	cachedEvidenceMeasure,
} from "./evidence/evidenceDocumentStore.ts";
import { availableReconciliations } from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	artifactDirectory,
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-runtime/storage";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const directory = artifactDirectory(repositoryRoot);
const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const write = (id: string, data: unknown) =>
	writeEvidenceDocument(directory, id, data);

const graph = await build({
	absWorkingDir: repositoryRoot,
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
		.map((path) => readFileSync(resolve(repositoryRoot, path), "utf8"))
		.join("\n"),
);

const inputsHash = (context: ReturnType<typeof readAtlasCatalogues>) =>
	evidenceInputsHash(directory, context);

const main = () => {
	const context = readAtlasCatalogues(repositoryRoot, {
		loadEvidenceDocuments: false,
	});
	const documents = [
		write("corrections", { status: 200, data: correctionsReport(null) }),
		write("geography-health", {
			status: 200,
			data: geographyHealthReport(context.geographyResolver, {
				geography: null,
				country: null,
				reach: null,
			}),
		}),
		write("relationship-repairs", {
			status: 200,
			data: relationshipRepairsReport(context.geographyResolver),
		}),
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
					measureCoverage: (context, id) => {
						if (!context.measureCompatibilityInventory)
							throw new Error(
								"Measure compatibility is required to build evidence",
							);
						const coverage = measureCoverage(
							context.dataCatalog,
							context.measureCompatibilityInventory,
							id,
						);
						if (!coverage)
							throw new Error(
								`No published measure coverage record matches ${id}`,
							);
						return coverage;
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
					reconciliation: reconciliationEvidence,
					coveragePlan: coveragePlanEvidence,
					measureCapability,
					availableReconciliations,
					write,
					compilerHash,
					inputsHash,
				}),
		);
		buildLog.detail(`Built evidence for ${measure.id}`);
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
	buildLog.info(
		`Wrote evidence documents for ${formatCount(documents.length)} measures to ${repoPath(directory)}`,
	);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
