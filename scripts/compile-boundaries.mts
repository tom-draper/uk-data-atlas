/**
 * Converts published ward GeoJSON into the compact TopoJSON assets served by
 * the application. The GeoJSON files remain in data/ as reproducible sources.
 *
 * Run `pnpm boundaries:compile --force` after changing the compression values
 * below. Preprocessing runs this automatically when a source is newer than
 * its generated TopoJSON asset.
 */
import { createHash } from "crypto";
import { readFile, rename, stat, writeFile } from "fs/promises";
import { basename, dirname, join } from "path";
import { fileURLToPath } from "url";
import { feature } from "topojson-client";
import { topology } from "topojson-server";
import { presimplify, simplify } from "topojson-simplify";

import { BOUNDARY_CATALOG } from "../lib/data/boundaries/catalog";
import { decodeBoundaryData } from "../lib/data/boundaries/decode";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WARDS_DIR = join(ROOT, "data", "boundaries", "wards");

// Increase quantization for more positional precision. Increase the minimum
// triangle area for a smaller, less detailed asset.
const QUANTIZATION = 100_000;
const MINIMUM_PLANAR_TRIANGLE_AREA = 0.0000001;

const WARD_GEOJSON_SOURCES = [
	"Wards_December_2016_GCB_in_Great_Britain_2022_856513180533154279.geojson",
	"Wards_December_2017_GCB_in_Great_Britain_2022_-2440043846989090720.geojson",
	"Wards_December_2018_GCB_UK_2022_-623525817862961610.geojson",
	"Wards_December_2019_GCB_GB_2022_-3199817513651023624.geojson",
] as const;

const KEEP_PROPERTIES = new Set([
	...BOUNDARY_CATALOG.ward.properties.code,
	...BOUNDARY_CATALOG.ward.properties.name,
	...(BOUNDARY_CATALOG.ward.properties.parentCode ?? []),
]);

const writeAtomically = async (path: string, contents: string) => {
	const temporaryPath = `${path}.${process.pid}.tmp`;
	await writeFile(temporaryPath, contents);
	await rename(temporaryPath, path);
};

const outputPathFor = (sourcePath: string) =>
	sourcePath.replace(/\.geojson$/, ".topojson");

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

const simplifyWardSource = (raw: string, objectName: string) => {
	const normalised = decodeBoundaryData(JSON.parse(raw));
	const cleaned = {
		...normalised,
		features: normalised.features.map((feature) => ({
			...feature,
			properties: Object.fromEntries(
				Object.entries(feature.properties ?? {}).filter(([key]) =>
					KEEP_PROPERTIES.has(key),
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

/** Ensures the committed TopoJSON assets are newer than their GeoJSON inputs. */
export async function compileBoundaryAssets(): Promise<void> {
	console.log("Preparing TopoJSON boundary assets...");
	for (const sourceName of WARD_GEOJSON_SOURCES) {
		const sourcePath = join(WARDS_DIR, sourceName);
		const outputPath = outputPathFor(sourcePath);
		const outputName = basename(outputPath);

		if (!(await shouldCompile(sourcePath, outputPath))) {
			console.log(`  boundary: ${outputName} (up to date)`);
			continue;
		}

		const raw = await readFile(sourcePath, "utf8");
		const topologyData = simplifyWardSource(raw, "wards");
		const output = JSON.stringify(topologyData);
		await writeAtomically(outputPath, output);
		const sourceKb = Math.round(Buffer.byteLength(raw, "utf8") / 1024);
		const outputKb = Math.round(Buffer.byteLength(output, "utf8") / 1024);
		const hash = createHash("sha256")
			.update(output)
			.digest("hex")
			.slice(0, 12);
		console.log(
			`  boundary: ${outputName} (${sourceKb} KB -> ${outputKb} KB, ${hash})`,
		);
	}
}

if (process.argv[1]?.endsWith("compile-boundaries.mts")) {
	await compileBoundaryAssets();
}
