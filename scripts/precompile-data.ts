/**
 * Pre-compiles all CSV datasets into compact JSON files served to the browser.
 * Eliminates PapaParse from the client bundle and removes main-thread CSV parsing.
 *
 * Run via: pnpm precompile
 * Also runs automatically before pnpm dev and pnpm build.
 */
import { readFile, mkdir, rename, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createHash } from "crypto";

import { CHART_DATASET_DEFINITIONS } from "../lib/datasets";
import {
	type SourceArtifact,
	validatePrecompiledDataset,
} from "../lib/datasets/ingestion";
import type { DatasetReader } from "../lib/data/catalog";
import { loadRoadSafety } from "../lib/data/road-safety/loader";
import { loadGazetteerCore } from "../lib/data/gazetteer/loader";
import { loadBoundaryMappings } from "../lib/data/boundaries/mappingLoader";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC_DATA = join(ROOT, "public", "data");
const SOURCE_DATA = join(ROOT, "data");
// Committed output. The public mirror below is
// gitignored and only used by the local dev/build server.
const OUT_DIR = join(SOURCE_DATA, "precompiled");
const PUBLIC_OUT_DIR = join(PUBLIC_DATA, "precompiled");

// Read source datasets directly. public/data only contains files that must be
// served to the browser during local development.
const read = (path: string) => readFile(join(SOURCE_DATA, path), "utf8");

// Reads a file relative to data/ (raw source data, not synced to public)
const readSource = (path: string) => readFile(join(SOURCE_DATA, path), "utf8");

// Extracts and reads the first CSV from a ZIP in data/ (never synced to public/)
const readZip = (path: string): Promise<string> => {
	const fullPath = join(SOURCE_DATA, path);
	return Promise.resolve(
		execSync(`unzip -p "${fullPath}" "*.csv"`, {
			maxBuffer: 100 * 1024 * 1024,
		}).toString("utf8"),
	);
};

// ODS source files are never exposed by the application. The child-poverty
// loader only needs its worksheet XML, which is then reduced to compact JSON.
const readOdsContent = (path: string): Promise<string> => {
	const fullPath = join(SOURCE_DATA, path);
	return Promise.resolve(
		execSync(`unzip -p "${fullPath}" content.xml`, {
			maxBuffer: 100 * 1024 * 1024,
		}).toString("utf8"),
	);
};

const writeAtomically = async (path: string, contents: string) => {
	const temporaryPath = `${path}.${process.pid}.tmp`;
	await writeFile(temporaryPath, contents);
	await rename(temporaryPath, path);
};

const out = async (name: string, data: unknown) => {
	const json = JSON.stringify(data);
	// Committed source of truth (pushed to the CDN repo) + gitignored copy the
	// local dev/build server serves from public/.
	await writeAtomically(join(OUT_DIR, `${name}.json`), json);
	await writeAtomically(join(PUBLIC_OUT_DIR, `${name}.json`), json);
	const kb = Math.round(Buffer.byteLength(json, "utf8") / 1024);
	console.log(`  precompiled: ${name}.json (${kb} KB)`);
	return { bytes: Buffer.byteLength(json, "utf8"), sha256: createHash("sha256").update(json).digest("hex") };
};

const createTrackedReader = () => {
	const artifacts = new Map<string, SourceArtifact>();
	const track = async (
		kind: SourceArtifact["kind"],
		path: string,
		readContent: () => Promise<string>,
	) => {
		const content = await readContent();
		artifacts.set(`${kind}:${path}`, {
			kind,
			path,
			bytes: Buffer.byteLength(content, "utf8"),
			sha256: createHash("sha256").update(content).digest("hex"),
		});
		return content;
	};
	const reader: DatasetReader = {
		text: (path) => track("text", path, () => read(path)),
		odsContent: (path) => track("odsContent", path, () => readOdsContent(path)),
		zipCsv: (path) => track("zipCsv", path, () => readZip(path)),
	};
	return { reader, artifacts };
};

async function main() {
	console.log("Pre-compiling datasets...");
	await mkdir(OUT_DIR, { recursive: true });
	await mkdir(PUBLIC_OUT_DIR, { recursive: true });

	const chartResults = CHART_DATASET_DEFINITIONS.map(async (definition) => {
		const { reader, artifacts } = createTrackedReader();
		const data = await definition.precompile(reader);
		const summary = validatePrecompiledDataset(definition, data);
		const output = await out(definition.precompiledFile, data);
		return {
			type: definition.type,
			output: definition.precompiledFile,
			source: definition.source,
			contract: definition.ingestion ?? {},
			inputs: [...artifacts.values()],
			summary,
			compiled: output,
		};
	});
	const results = await Promise.allSettled([
		...chartResults,
		loadRoadSafety(readSource).then((d) => out("road-safety", d)),
		loadGazetteerCore(read).then((d) => out("gazetteer.core", d)),
		loadBoundaryMappings(read).then((d) => out("boundary-mappings", d)),
	]);

	const failures = results.filter(
		(r): r is PromiseRejectedResult => r.status === "rejected",
	);
	if (failures.length > 0) {
		for (const f of failures) console.error("  ERROR:", f.reason);
		process.exit(1);
	}
	await out("dataset-manifest", {
		version: 1,
		datasets: results.slice(0, CHART_DATASET_DEFINITIONS.length).map(
			(result) => (result as PromiseFulfilledResult<unknown>).value,
		),
	});

	console.log("Done.");
}

main();
