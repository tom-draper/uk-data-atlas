/**
 * Converts published boundary GeoJSON into the compact TopoJSON assets served
 * by the application. The GeoJSON files remain in data/ as reproducible
 * sources.
 *
 * Run `pnpm boundaries:compile --force` after changing the compression values
 * below. Preprocessing runs this automatically when a source is newer than
 * its generated TopoJSON asset.
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { readFile, rename, stat, writeFile } from "fs/promises";
import { basename, dirname, join } from "path";
import { fileURLToPath } from "url";
import { feature } from "topojson-client";
import { topology } from "topojson-server";
import { presimplify, simplify } from "topojson-simplify";

import {
	BOUNDARY_CATALOG,
	BOUNDARY_TYPES,
} from "../lib/data/boundaries/catalog";
import { decodeBoundaryData } from "../lib/data/boundaries/decode";
import { parseDatasetMeta } from "../lib/data/catalog/meta";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Increase quantization for more positional precision. Increase the minimum
// triangle area for a smaller, less detailed asset.
const QUANTIZATION = 100_000;
const MINIMUM_PLANAR_TRIANGLE_AREA = 0.0000001;

/**
 * The GeoJSON a release is compiled from, named by its own meta.json.
 *
 * Sources keep the filename the publisher gave them, so that someone
 * searching for a published boundary file finds this repository. The name
 * therefore differs per release and cannot be hardcoded — the one exception
 * being a GeoJSON this project converted itself, which never had a published
 * name and stays `source.geojson`. A release's meta lists exactly one GeoJSON
 * that is not a lookup or a companion, and that is the one to read.
 */
const sourceFromMeta = (releaseDir: string, label: string): string | null => {
	const meta = parseDatasetMeta(
		JSON.parse(readFileSync(join(releaseDir, "meta.json"), "utf8")),
		basename(releaseDir),
	);
	const sources = meta.files.filter(
		(file) =>
			file.path.endsWith(".geojson") &&
			(file.role === "source" || file.role === "derived"),
	);
	// A release published only as TopoJSON, or converted outside this repo,
	// lists no GeoJSON at all; the caller reports it as unreproducible.
	if (sources.length === 0) return null;
	if (sources.length > 1) {
		throw new Error(
			`${label}: meta.json lists ${sources.length} source GeoJSON files, expected one`,
		);
	}
	return join(releaseDir, sources[0]!.path);
};

/**
 * Every release the catalogue serves, paired with the published GeoJSON it is
 * compiled from. Derived from the catalogue rather than listed here, so adding
 * a release needs no change to this script.
 *
 * The properties to keep come from the release itself, not from its
 * geography. Filtering by a shared list is how the Dec 2020 ward and Dec 2015
 * constituency assets came to be written with every property stripped: the
 * list happened not to mention WD20CD, and spelled pcon15cd in the wrong case,
 * so the filter matched nothing and kept nothing.
 */
const releaseSources = () =>
	BOUNDARY_TYPES.flatMap((type) =>
		BOUNDARY_CATALOG[type].releases.flatMap((release) => {
			if (!release.asset) return [];
			// withCDN appends a version query outside development.
			const relative = release.asset
				.split("?")[0]!
				.replace(/^\/data\//, "");
			const outputPath = join(ROOT, "data", relative);
			return [
				{
					label: `${type}/${release.id}`,
					objectName: type,
					keep: new Set<string>([
						release.codeKey,
						release.nameKey,
						...(release.parentCodeKey
							? [release.parentCodeKey]
							: []),
					]),
					sourcePath: sourceFromMeta(
						dirname(outputPath),
						`${type}/${release.id}`,
					),
					outputPath,
				},
			];
		}),
	).sort((a, b) => a.label.localeCompare(b.label));

const writeAtomically = async (path: string, contents: string) => {
	const temporaryPath = `${path}.${process.pid}.tmp`;
	await writeFile(temporaryPath, contents);
	await rename(temporaryPath, path);
};

const exists = async (path: string) => {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
};

const shouldCompile = async (sourcePath: string, outputPath: string) => {
	if (process.argv.includes("--force")) return true;
	try {
		const [source, output] = await Promise.all([
			stat(sourcePath),
			stat(outputPath),
		]);
		return source.mtimeMs > output.mtimeMs;
	} catch {
		return true;
	}
};

const simplifySource = (
	raw: string,
	objectName: string,
	keep: ReadonlySet<string>,
) => {
	const normalised = decodeBoundaryData(JSON.parse(raw));
	const cleaned = {
		...normalised,
		features: normalised.features.map((feature) => ({
			...feature,
			properties: Object.fromEntries(
				Object.entries(feature.properties ?? {}).filter(([key]) =>
					keep.has(key),
				),
			),
		})),
	};
	const simplified = simplify(
		presimplify(topology({ [objectName]: cleaned })),
		MINIMUM_PLANAR_TRIANGLE_AREA,
	);
	const simplifiedFeatures = feature(
		simplified,
		simplified.objects[objectName]!,
	);
	return topology({ [objectName]: simplifiedFeatures }, QUANTIZATION);
};

/** A release whose compiled asset would carry no properties at all. */
const assertKeptSomething = (
	label: string,
	topologyData: { objects: Record<string, unknown> },
	keep: ReadonlySet<string>,
) => {
	const object = Object.values(topologyData.objects)[0] as {
		geometries?: { properties?: Record<string, unknown> }[];
	};
	const first = object?.geometries?.[0]?.properties ?? {};
	if (Object.keys(first).length === 0) {
		throw new Error(
			`${label}: none of ${[...keep].join(", ")} are properties of this ` +
				`source, so every feature would be written anonymous. Check the ` +
				`keys the release declares against the file.`,
		);
	}
};

/** Ensures the committed TopoJSON assets are newer than their GeoJSON inputs. */
export async function compileBoundaryAssets(): Promise<void> {
	const sources = releaseSources();
	console.log(
		`Preparing TopoJSON boundary assets (${sources.length} releases)...`,
	);
	for (const { label, objectName, keep, sourcePath, outputPath } of sources) {
		// A release published only as TopoJSON cannot be rebuilt here. Say so
		// rather than failing, so it is visible as unreproducible.
		if (sourcePath === null || !(await exists(sourcePath))) {
			console.log(
				`  boundary: ${label} (no local GeoJSON source, skipped)`,
			);
			continue;
		}

		if (!(await shouldCompile(sourcePath, outputPath))) {
			console.log(`  boundary: ${label} (up to date)`);
			continue;
		}

		const raw = await readFile(sourcePath, "utf8");
		const topologyData = simplifySource(raw, objectName, keep);
		assertKeptSomething(label, topologyData, keep);
		const output = JSON.stringify(topologyData);
		await writeAtomically(outputPath, output);
		const sourceKb = Math.round(Buffer.byteLength(raw, "utf8") / 1024);
		const outputKb = Math.round(Buffer.byteLength(output, "utf8") / 1024);
		const hash = createHash("sha256")
			.update(output)
			.digest("hex")
			.slice(0, 12);
		console.log(
			`  boundary: ${label} (${sourceKb} KB -> ${outputKb} KB, ${hash})`,
		);
	}
}

if (process.argv[1]?.endsWith("compile-boundaries.mts")) {
	await compileBoundaryAssets();
}
