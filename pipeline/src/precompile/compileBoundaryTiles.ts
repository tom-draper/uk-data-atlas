/** Compile every website release to PMTiles, including releases with overlapping polygons. */
import { parseScriptArgs } from "../lib/args.ts";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import {
	link,
	mkdir,
	mkdtemp,
	readFile,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { parseDatasetMeta } from "@uk-data-atlas/datasets";
import { decodeBoundaryData } from "@uk-data-atlas/datasets";
import { compilePolygonArchive } from "@uk-data-atlas/geometry/tiles";
import {
	compileTileset,
	NonCoverageError,
} from "@uk-data-atlas/geometry/tiles";
import { MAX_ZOOM, MIN_ZOOM } from "@uk-data-atlas/geometry/tiles";
import type { GeoJsonGeometry } from "@uk-data-atlas/geometry/tiles";
import {
	assertCompleteBoundaryResources,
	parseBoundaryResources,
	websiteBoundaryReleases,
	type BoundaryResource,
	type BoundaryResources,
} from "@uk-data-atlas/areas";
import { correctedSource, releaseSources } from "./compileBoundaries.ts";
import { buildLog, elapsedSince, formatCount } from "@uk-data-atlas/atlas-db";
import { readJson } from "../lib/json.ts";
import { datasetConcurrency } from "./datasetConcurrency.mjs";
import { runBoundaryTileJobs } from "./boundaryTilePool.ts";
import { stopTrialIfWork } from "../lib/trialRun.ts";

const COMPILED_POLYGON_RELEASES: Readonly<Record<string, number>> = {
	"ward/2017-12-gb-bgc": 3,
	"lsoa/2001-12-ew-bgc": 91,
};

const ROOT = join(import.meta.dirname, "../../..");
const INTERMEDIATES = join(ROOT, "data/build/website-boundaries");
export const TILES_FILENAME = "boundaries.pmtiles";
export const TILES_MANIFEST = "boundaries/tiles.json";
const TILER_SOURCES = [
	import.meta.filename,
	join(import.meta.dirname, "boundaryTilePool.ts"),
	join(import.meta.dirname, "boundaryTileWorker.ts"),
	join(ROOT, "packages/areas/src/boundaryResources.ts"),
	...readdirSync(join(ROOT, "packages/geometry/src/tiles")).map((name) =>
		join(ROOT, "packages/geometry/src/tiles", name),
	),
];

async function writeAtomically(path: string, contents: string | Uint8Array) {
	await mkdir(dirname(path), { recursive: true });
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		await writeFile(temporary, contents);
		await rename(temporary, path);
	} finally {
		await rm(temporary, { force: true });
	}
}

async function isStale(inputs: string[], output: string) {
	if (parseScriptArgs({ force: { type: "boolean" } }).values.force === true)
		return true;
	const built = await stat(output).catch(() => undefined);
	if (!built) return true;
	for (const input of inputs)
		if ((await stat(input)).mtimeMs > built.mtimeMs) return true;
	return false;
}
/** One geometry per code; a code split across features becomes a MultiPolygon. */
const areasByCode = (
	features: Array<{
		properties: object | null;
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
		const code = feature.properties
			? Reflect.get(feature.properties, codeKey)
			: undefined;
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

/** Compile one independent release. The caller publishes the returned archive. */
export async function compileBoundaryRelease(label: string, asset: string) {
	const relativeDirectory = dirname(asset.replace(/^\/data\//, ""));
	const topologyPath = join(
		INTERMEDIATES,
		relativeDirectory,
		"boundaries.topojson",
	);
	const source = releaseSources(INTERMEDIATES).find(
		(candidate) => candidate.label === label,
	);
	const collection =
		source?.sourcePath && existsSync(source.sourcePath)
			? await correctedSource(
					await readFile(source.sourcePath, "utf8"),
					source,
				)
			: decodeBoundaryData(await readJson(topologyPath));
	const release =
		source ??
		(() => {
			throw new Error(`Missing source metadata for ${label}`);
		})();
	const features = collection.features;
	const areas = areasByCode(features, release.codeKey, label);
	const properties: { features: Record<string, unknown>[] } = await readJson(
		join(INTERMEDIATES, relativeDirectory, "properties.json"),
	);
	const propertyCodes = [
		...new Set(
			properties.features.map(
				(properties) => properties[release.codeKey],
			),
		),
	].sort();
	if (
		JSON.stringify([...areas.keys()].sort()) !==
		JSON.stringify(propertyCodes)
	)
		throw new Error(
			`${label}: map geometry and properties have different area codes.`,
		);
	const names = new Map(
		features.flatMap((feature) => {
			const code = feature.properties
				? Reflect.get(feature.properties, release.codeKey)
				: undefined;
			const name = feature.properties
				? Reflect.get(feature.properties, release.nameKey)
				: undefined;
			return typeof code === "string" && typeof name === "string"
				? [[code, name] as const]
				: [];
		}),
	);
	const meta = parseDatasetMeta(
		await readJson(join(dirname(release.topologySourcePath), "meta.json")),
		basename(dirname(release.topologySourcePath)),
	);
	const assertIds = (ids: Map<string, number>) => {
		const numbered = [...ids].sort(([a], [b]) => a.localeCompare(b));
		if (
			numbered.length !== propertyCodes.length ||
			numbered.some(
				([code, id], index) =>
					code !== propertyCodes[index] || id !== index + 1,
			)
		)
			throw new Error(
				`${label}: tile IDs do not match the properties sidecar.`,
			);
	};
	let entry: BoundaryResource;
	let bytes: Uint8Array;
	try {
		const tileset = compileTileset(areas, {
			name: label,
			description: meta.title,
			attribution: `Contains ${meta.publisher} data, ${meta.licence.name}`,
			names,
			gzip: gzipSync,
		});
		assertIds(tileset.ids);
		bytes = tileset.archive;
		entry = {
			method: "shared-arcs",
			href: asset.replace(/\.topojson$/, ".pmtiles"),
			bytes: tileset.archive.length,
		};
	} catch (error) {
		if (
			!(error instanceof NonCoverageError) ||
			COMPILED_POLYGON_RELEASES[label] !== error.edgeCount
		)
			throw error;
		// Keep the shapes previously drawn from TopoJSON, including overlaps.
		const polygons = decodeBoundaryData(await readJson(topologyPath));
		const archive = compilePolygonArchive(
			areasByCode(polygons.features, release.codeKey, label),
			{
				name: label,
				description: meta.title,
				attribution: `Contains ${meta.publisher} data, ${meta.licence.name}`,
				names,
				gzip: gzipSync,
			},
		);
		assertIds(archive.ids);
		bytes = archive.archive;
		entry = {
			method: "compiled-polygons",
			href: asset.replace(/\.topojson$/, ".pmtiles"),
			bytes: archive.archive.length,
			reason: error.message,
		};
	}
	return { entry, bytes };
}

export async function compileBoundaryTiles(): Promise<BoundaryResources> {
	const startedAt = performance.now();
	const flag = parseScriptArgs({ only: { type: "string" } }).values.only;
	const only = typeof flag === "string" ? flag : undefined;
	const manifestPath = join(ROOT, "data/build", TILES_MANIFEST);
	const manifest: BoundaryResources = only
		? parseBoundaryResources(await readJson(manifestPath))
		: {
				schemaVersion: 2,
				minZoom: MIN_ZOOM,
				maxZoom: MAX_ZOOM,
				releases: {},
			};
	const sources = releaseSources(INTERMEDIATES);
	const byLabel = new Map(sources.map((source) => [source.label, source]));
	const releases = websiteBoundaryReleases().filter(
		({ key }) => !only || key === only,
	);
	if (releases.length === 0)
		throw new Error(`Unknown boundary release: ${only}`);
	const jobs: Array<{ label: string; asset: string }> = [];
	const entries = new Map<string, BoundaryResource>();
	for (const { key: label, asset } of releases) {
		const relativeDirectory = dirname(asset.replace(/^\/data\//, ""));
		const directory = join(ROOT, "data/build", relativeDirectory);
		const descriptorPath = join(directory, "resource.json");
		const propertiesPath = join(
			INTERMEDIATES,
			relativeDirectory,
			"properties.json",
		);
		const topologyPath = join(
			INTERMEDIATES,
			relativeDirectory,
			"boundaries.topojson",
		);
		const source = byLabel.get(label);
		const inputs = [
			topologyPath,
			propertiesPath,
			...TILER_SOURCES,
			...(source?.inputs ?? []),
		];
		if (source?.sourcePath && existsSync(source.sourcePath))
			inputs.push(source.sourcePath);
		if (!(await isStale(inputs, descriptorPath))) {
			const cached = await readJson(descriptorPath);
			const entry = parseBoundaryResources({
				...manifest,
				releases: { [label]: cached },
			}).releases[label]!;
			if (
				(
					await stat(
						join(
							ROOT,
							"data/build",
							entry.href.replace(/^\/data\//, ""),
						),
					).catch(() => undefined)
				)?.size === entry.bytes
			) {
				entries.set(label, entry);
				continue;
			}
		}
		jobs.push({ label, asset });
	}
	stopTrialIfWork(jobs.length, "boundary tile releases");
	// Nothing is published until every worker has succeeded. The parent writes
	// worker results to scratch as they arrive to keep memory bounded.
	await mkdir(dirname(manifestPath), { recursive: true });
	const staging = await mkdtemp(join(dirname(manifestPath), ".tiles-"));
	try {
		await runBoundaryTileJobs(
			jobs,
			Math.min(datasetConcurrency(), jobs.length),
			async (index, result) => {
				await writeFile(join(staging, String(index)), result.bytes);
				entries.set(jobs[index]!.label, result.entry);
			},
		);
		for (const { key } of releases)
			manifest.releases[key] = entries.get(key)!;
		assertCompleteBoundaryResources(manifest);
		const jobIndexes = new Map(
			jobs.map((job, index) => [job.label, index]),
		);
		for (const { key: label, asset } of releases) {
			const relativeDirectory = dirname(asset.replace(/^\/data\//, ""));
			const directory = join(ROOT, "data/build", relativeDirectory);
			await mkdir(directory, { recursive: true });
			const temporaryProperties = join(
				directory,
				`properties.${randomUUID()}.tmp`,
			);
			try {
				await link(
					join(INTERMEDIATES, relativeDirectory, "properties.json"),
					temporaryProperties,
				);
				await rename(
					temporaryProperties,
					join(directory, "properties.json"),
				);
			} finally {
				await rm(temporaryProperties, { force: true });
			}
			const index = jobIndexes.get(label);
			const entry = entries.get(label)!;
			if (index !== undefined) {
				await rename(
					join(staging, String(index)),
					join(directory, TILES_FILENAME),
				);
				await writeAtomically(
					join(directory, "resource.json"),
					JSON.stringify(entry),
				);
			}
			buildLog.artifact("tiles", label, {
				status: index === undefined ? "cached" : entry.method,
				bytes: entry.bytes,
			});
		}
	} finally {
		await rm(staging, { recursive: true, force: true });
	}

	assertCompleteBoundaryResources(manifest);
	await writeAtomically(
		manifestPath,
		JSON.stringify(manifest, null, "\t") + "\n",
	);
	buildLog.info(
		`Compiled ${formatCount(Object.keys(manifest.releases).length)} boundary map resources in ${elapsedSince(startedAt)}`,
	);
	return manifest;
}
