import { build } from "esbuild";
import { measureCapability } from "../src/measureCapability";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { readApiCatalogues } from "../src/catalogueLoader";
import { evidenceReport, type EvidenceDocument } from "../src/evidenceReports";
import { availableReconciliations } from "../src/measureReconciliation";
import { publicJson } from "../src/publicJson";
import type { RouteContext } from "../src/routing";

const apiRoot = resolve(import.meta.dirname, "..");
const directory = join(apiRoot, "public");
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

const write = (id: string, data: unknown): EvidenceDocument => {
	const artifact = `documents/${id}.json`;
	const body = `${publicJson({ schemaVersion: 1, data })}\n`;
	mkdirSync(join(directory, "documents"), { recursive: true });
	writeFileSync(join(directory, artifact), body);
	return {
		id,
		artifact,
		bytes: Buffer.byteLength(body),
		contentHash: sha256(body),
	};
};

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
	sha256(
		JSON.stringify([
			context.boundaryRegistry.contentHash,
			context.areaInventory.contentHash,
			context.namedLocationInventory.contentHash,
			context.crosswalkInventory.contentHash,
			context.relationshipPathInventory.contentHash,
			context.relationshipCandidateInventory.contentHash,
			context.geographyInventory.contentHash,
			context.dataCatalog.contentHash,
			context.exportManifest.contentHash,
			context.measureCompatibilityInventory.contentHash,
			context.analysisGeographyInventory.contentHash,
			context.analysisGeographyValidationInventory.contentHash,
			sha256(
				readFileSync(join(directory, "geometry-sources.json"), "utf8"),
			),
		]),
	);

const cachedMeasure = (
	id: string,
	sourceHash: string,
): EvidenceDocument | undefined => {
	const artifact = `documents/measure-${id}.json`;
	const path = join(directory, artifact);
	if (!existsSync(path)) return undefined;
	const body = readFileSync(path, "utf8");
	const existing: { data: { compilerHash?: string; inputsHash?: string } } =
		JSON.parse(body);
	if (
		existing.data.compilerHash !== compilerHash ||
		existing.data.inputsHash !== sourceHash
	)
		return undefined;
	return {
		id: `measure-${id}`,
		artifact,
		bytes: Buffer.byteLength(body),
		contentHash: sha256(body),
	};
};

const buildMeasure = (
	context: ReturnType<typeof readApiCatalogues>,
	id: string,
) => {
	const measure = context.dataCatalog.measures.find(
		(measure) => measure.id === id,
	);
	if (!measure) throw new Error(`Unknown measure ${id}`);
	const base = `/v1/measures/${id}`;
	const quality = report(context, `${base}/quality`);
	const coverage = report(context, `${base}/coverage`);
	const compatibility = report(context, `${base}/compatibility`);
	const conversionSupport = report(context, `${base}/conversion-support`);
	const coveragePlans = context.areaInventory.releases.flatMap((release) =>
		release.status === "available"
			? [
					{
						geography: release.geography,
						release: release.id,
						capability: measureCapability(context, measure, {
							geography: release.geography,
							boundaryRelease: release.id,
						}),
						...report(
							context,
							`${base}/coverage-plan?geography=${release.geography}&release=${release.id}`,
						),
					},
				]
			: [],
	);
	const available = availableReconciliations(context, measure);
	const reconciliations = available.flatMap((candidate) =>
		candidate.periods.map((period) => {
			const selector =
				"crosswalk" in candidate
					? `crosswalk=${encodeURIComponent(candidate.crosswalk.id)}`
					: `path=${encodeURIComponent(candidate.path.id)}`;
			return {
				selector,
				period,
				...report(
					context,
					`${base}/reconciliation?${selector}&period=${encodeURIComponent(period)}`,
				),
			};
		}),
	);
	return write(`measure-${id}`, {
		measure: id,
		dataCatalogHash: context.dataCatalog.contentHash,
		compilerHash,
		inputsHash: inputsHash(context),
		quality,
		coverage,
		compatibility,
		conversionSupport,
		coveragePlans,
		reconciliations,
	});
};

const buildChild = (id: string): Promise<EvidenceDocument> =>
	new Promise((resolveDocument, reject) => {
		const child = spawn(
			process.execPath,
			[
				...process.execArgv,
				fileURLToPath(import.meta.url),
				"--measure",
				id,
			],
			{ stdio: ["ignore", "pipe", "inherit"] },
		);
		let output = "";
		child.stdout.setEncoding("utf8").on("data", (chunk) => {
			output += chunk;
		});
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code !== 0)
				return reject(
					new Error(`Evidence build for ${id} exited ${code}`),
				);
			const document: EvidenceDocument = JSON.parse(output);
			resolveDocument(document);
		});
	});

const main = async () => {
	if (
		process.env.ATLAS_EVIDENCE_COMPILER_HASH &&
		process.env.ATLAS_EVIDENCE_COMPILER_HASH !== compilerHash
	)
		throw new Error(
			"The evidence compiler changed during the build. Rerun build:documents.",
		);
	const context = readApiCatalogues(apiRoot, {
		loadEvidenceDocuments: false,
	});
	const measureId = process.argv[process.argv.indexOf("--measure") + 1];
	if (process.argv.includes("--measure")) {
		process.stdout.write(JSON.stringify(buildMeasure(context, measureId!)));
		return;
	}
	const documents = [
		write("corrections", report(context, "/v1/corrections")),
		write("geography-health", report(context, "/v1/geography-health")),
		write(
			"relationship-repairs",
			report(context, "/v1/relationship-repairs"),
		),
	];
	const sourceHash = inputsHash(context);
	for (
		let index = 0;
		index < context.dataCatalog.measures.length;
		index += 2
	) {
		const batch = context.dataCatalog.measures.slice(index, index + 2);
		const built = await Promise.all(
			batch.map(
				async (measure) =>
					cachedMeasure(measure.id, sourceHash) ??
					(await buildChild(measure.id)),
			),
		);
		documents.push(...built);
		for (const measure of batch)
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

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
