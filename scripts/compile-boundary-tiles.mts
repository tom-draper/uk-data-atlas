/**
 * Compiles the finer boundary families into PMTiles vector tiles, written
 * into data/build, then copied to public/data so the map can fetch only the
 * tiles in view rather than a whole release.
 *
 * The tiles come from the same corrected source as the TopoJSON, and are cut by
 * the tiler the API uses (`@uk-data-atlas/map-tiles`), so the two consumers
 * share one tile format. A release that is not a coverage cannot be tiled; it
 * is recorded as untiled and the map keeps drawing its TopoJSON.
 *
 * Run `node --import tsx scripts/compile-boundary-tiles.mts --force` after changing the tiler, or add
 * `--only=ward/2026-05-uk-bgc` to retile one release.
 */
import { existsSync, readdirSync } from "fs";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import { basename, dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";

import { boundaryServesVectorTiles } from "@uk-data-atlas/datasets/data/boundaries/capabilities";
import { parseDatasetMeta } from "@uk-data-atlas/datasets/data/catalog/meta";
import { compileTileset } from "@uk-data-atlas/map-tiles/compileTileset";
import { MAX_ZOOM, MIN_ZOOM } from "@uk-data-atlas/map-tiles/tileset";
import type { GeoJsonGeometry } from "@uk-data-atlas/map-tiles/types";
import { correctedSource, releaseSources } from "./compile-boundaries.mts";
import { copyBoundaryTiles } from "./copy-boundary-tiles.ts";
import { elapsedSince, formatKb, logArtifact } from "./timing.mts";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export const TILES_FILENAME = "boundaries.pmtiles";
/** Written instead of the tiles when a release cannot be tiled, with why. */
const UNTILED_FILENAME = "boundaries.untiled.json";
/** Lists every tiled release, so the map knows which to draw from tiles. */
export const TILES_MANIFEST = join("boundaries", "tiles.json");

export type BoundaryTilesManifest = {
	minZoom: number;
	maxZoom: number;
	/** Keyed by `type/release`, e.g. `ward/2024-05-uk-bgc`. */
	releases: Record<string, { href: string; bytes: number }>;
	untiled: Record<string, string>;
};

/** A change to the tiler or this script retiles every release. */
const TILER_SOURCES = [
	fileURLToPath(import.meta.url),
	...readdirSync(join(ROOT, "packages", "map-tiles", "src")).map((name) =>
		join(ROOT, "packages", "map-tiles", "src", name),
	),
];

const isStale = async (inputs: string[], output: string) => {
	if (process.argv.includes("--force")) return true;
	try {
		const [built, ...sources] = await Promise.all(
			[output, ...inputs].map((path) => stat(path)),
		);
		return sources.some((source) => source.mtimeMs > built!.mtimeMs);
	} catch {
		return true;
	}
};

/** One geometry per code; a code split across features becomes a MultiPolygon. */
const areasByCode = (
	features: Array<{
		properties: Record<string, unknown> | null;
		geometry: GeoJsonGeometry | null;
	}>,
	codeKey: string,
	label: string,
) => {
	const areas = new Map<string, GeoJsonGeometry>();
	const polygons = (geometry: GeoJsonGeometry) =>
		geometry.type === "Polygon"
			? [geometry.coordinates]
			: geometry.type === "MultiPolygon"
				? (geometry.coordinates as unknown[])
				: [];
	for (const feature of features) {
		const code = feature.properties?.[codeKey];
		if (typeof code !== "string" || !feature.geometry) continue;
		const existing = areas.get(code);
		areas.set(
			code,
			existing
				? {
						type: "MultiPolygon",
						coordinates: [
							...polygons(existing),
							...polygons(feature.geometry),
						],
					}
				: feature.geometry,
		);
	}
	if (areas.size === 0)
		throw new Error(`${label}: no feature carries a ${codeKey} code.`);
	return areas;
};

export async function compileBoundaryTiles(
	outputDirectory = join(ROOT, "public", "data"),
): Promise<BoundaryTilesManifest> {
	const startedAt = performance.now();
	// `--only=ward/2026-05-uk-bgc` tiles one release, for trying a change.
	const only = process.argv
		.find((arg) => arg.startsWith("--only="))
		?.slice("--only=".length);
	const sources = releaseSources(outputDirectory).filter(
		({ type, label }) =>
			boundaryServesVectorTiles(type) && (!only || label === only),
	);
	console.log(`Preparing ${sources.length} vector tile archives...`);
	const manifest: { releases: Record<string, unknown> } = {
		minZoom: MIN_ZOOM,
		maxZoom: MAX_ZOOM,
		releases: {},
		untiled: {},
	};
	const record = async (label: string, directory: string) => {
		const tilesPath = join(directory, TILES_FILENAME);
		const untiledPath = join(directory, UNTILED_FILENAME);
		if (existsSync(tilesPath))
			manifest.releases[label] = {
				href: `/data/${relative(join(ROOT, "data/build"), tilesPath)}`,
				bytes: (await stat(tilesPath)).size,
			};
		else if (existsSync(untiledPath))
			manifest.untiled[label] = (
				JSON.parse(await readFile(untiledPath, "utf8")) as {
					reason: string;
				}
			).reason;
	};

	for (const source of sources) {
		const releaseStartedAt = performance.now();
		const { label, sourcePath, outputPath, codeKey, nameKey } = source;
		const directory = join(
			ROOT,
			"data/build",
			relative(outputDirectory, dirname(outputPath)),
		);
		const tilesPath = join(directory, TILES_FILENAME);
		const untiledPath = join(directory, UNTILED_FILENAME);
		const built = existsSync(tilesPath) ? tilesPath : untiledPath;

		// Without its source a release keeps whatever tiles it already has.
		if (!sourcePath || !existsSync(sourcePath)) {
			await record(label, directory);
			logArtifact("tiles", label, [
				"skipped, local GeoJSON source missing",
				elapsedSince(releaseStartedAt),
			]);
			continue;
		}
		if (
			!(await isStale(
				[sourcePath, ...source.inputs, ...TILER_SOURCES],
				built,
			))
		) {
			await record(label, directory);
			logArtifact("tiles", label, [
				"cached",
				existsSync(tilesPath)
					? formatKb((await stat(tilesPath)).size)
					: "untiled",
				elapsedSince(releaseStartedAt),
			]);
			continue;
		}

		const collection = await correctedSource(
			await readFile(sourcePath, "utf8"),
			source,
		);
		const features = collection.features as unknown as Parameters<
			typeof areasByCode
		>[0];
		const names = new Map(
			features.flatMap((feature) => {
				const code = feature.properties?.[codeKey];
				const name = feature.properties?.[nameKey];
				return typeof code === "string" && typeof name === "string"
					? [[code, name] as const]
					: [];
			}),
		);
		const meta = parseDatasetMeta(
			JSON.parse(
				await readFile(join(dirname(sourcePath), "meta.json"), "utf8"),
			),
			basename(dirname(sourcePath)),
		);
		await mkdir(directory, { recursive: true });
		try {
			const tileset = compileTileset(
				areasByCode(features, codeKey, label),
				{
					name: label,
					description: meta.title,
					attribution: `Contains ${meta.publisher} data, ${meta.licence.name}`,
					names,
					gzip: gzipSync,
				},
			);
			await writeFile(tilesPath, tileset.archive);
			await rm(untiledPath, { force: true });
			logArtifact("tiles", label, [
				"compiled",
				`${tileset.tileCount} tiles`,
				formatKb(tileset.archive.length),
				elapsedSince(releaseStartedAt),
			]);
		} catch (error) {
			const reason = (error as Error).message;
			if (!reason.includes("is not a coverage")) throw error;
			await writeFile(untiledPath, JSON.stringify({ reason }) + "\n");
			await rm(tilesPath, { force: true });
			logArtifact("tiles", label, [
				"untiled, not a coverage",
				elapsedSince(releaseStartedAt),
			]);
		}
		await record(label, directory);
	}

	const manifestPath = join(ROOT, "data/build", TILES_MANIFEST);
	await mkdir(dirname(manifestPath), { recursive: true });
	await writeFile(manifestPath, JSON.stringify(manifest, null, "\t") + "\n");
	console.log(
		`Vector tiles complete: ${Object.keys(manifest.releases).length} tiled, ` +
			`${Object.keys(manifest.untiled).length} untiled (${elapsedSince(startedAt)}).`,
	);
	await copyBoundaryTiles(ROOT, outputDirectory);
	return manifest;
}

if (process.argv[1]?.endsWith("compile-boundary-tiles.mts")) {
	await compileBoundaryTiles();
}
