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

// Increase quantization for more positional precision. Increase the minimum
// triangle area for a smaller, less detailed asset.
const QUANTIZATION = 100_000;
const MINIMUM_PLANAR_TRIANGLE_AREA = 0.0000001;

/**
 * The TopoJSON asset each ward vintage is served from, paired with the
 * published GeoJSON it is compiled from. Derived from the catalogue rather
 * than listed here, so every vintage the application serves stays
 * reproducible and adding one needs no change to this script.
 */
const wardVintageSources = () =>
	Object.entries(BOUNDARY_CATALOG.ward.vintages)
		.map(([year, assetPath]) => {
			// withCDN appends a version query outside development.
			const relative = assetPath.split("?")[0]!.replace(/^\/data\//, "");
			const outputPath = join(ROOT, "data", relative);
			return {
				year: Number(year),
				sourcePath: outputPath.replace(/\.topojson$/, ".geojson"),
				outputPath,
			};
		})
		.sort((a, b) => a.year - b.year);

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
	const sources = wardVintageSources();
	console.log(
		`Preparing TopoJSON boundary assets (${sources.length} ward vintages)...`,
	);
	for (const { year, sourcePath, outputPath } of sources) {
		const outputName = basename(outputPath);

		// A vintage published only as TopoJSON cannot be rebuilt here. Say so
		// rather than failing, so it is visible as unreproducible.
		if (!(await exists(sourcePath))) {
			console.log(
				`  boundary: ${year} ${outputName} (no local GeoJSON source, skipped)`,
			);
			continue;
		}

		if (!(await shouldCompile(sourcePath, outputPath))) {
			console.log(`  boundary: ${year} ${outputName} (up to date)`);
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
			`  boundary: ${year} ${outputName} (${sourceKb} KB -> ${outputKb} KB, ${hash})`,
		);
	}
}

if (process.argv[1]?.endsWith("compile-boundaries.mts")) {
	await compileBoundaryAssets();
}
