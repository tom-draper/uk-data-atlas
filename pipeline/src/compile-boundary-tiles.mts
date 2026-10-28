/** Compile every website release to PMTiles, including releases with overlapping polygons. */
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import {
	link,
	mkdir,
	readFile,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { parseDatasetMeta } from "@uk-data-atlas/datasets/data/catalog/meta";
import { decodeBoundaryData } from "@uk-data-atlas/datasets/data/boundaries/decode";
import { compilePolygonArchive } from "@uk-data-atlas/map-tiles/compileArchive";
import {
	compileTileset,
	NonCoverageError,
} from "@uk-data-atlas/map-tiles/compileTileset";
import { MAX_ZOOM, MIN_ZOOM } from "@uk-data-atlas/map-tiles/tileset";
import type { GeoJsonGeometry } from "@uk-data-atlas/map-tiles/types";
import {
	assertCompleteBoundaryResources,
	parseBoundaryResources,
	websiteBoundaryReleases,
	type BoundaryResource,
	type BoundaryResources,
} from "@uk-data-atlas/atlas-runtime/areas";
import { correctedSource, releaseSources } from "./compile-boundaries.mts";
import {
	elapsedSince,
	formatKb,
	logArtifact,
} from "@uk-data-atlas/atlas-runtime/storage";

const COMPILED_POLYGON_RELEASES: Readonly<Record<string, number>> = {
	"ward/2017-12-gb-bgc": 3,
	"lsoa/2001-12-ew-bgc": 91,
};

const ROOT = join(import.meta.dirname, "../..");
const INTERMEDIATES = join(ROOT, "data/build/website-boundaries");
export const TILES_FILENAME = "boundaries.pmtiles";
export const TILES_MANIFEST = "boundaries/tiles.json";
const TILER_SOURCES = [
	import.meta.filename,
	join(ROOT, "packages/atlas-runtime/src/areas/boundaryResources.ts"),
	...readdirSync(join(ROOT, "packages/map-tiles/src")).map((name) =>
		join(ROOT, "packages/map-tiles/src", name),
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
	if (process.argv.includes("--force")) return true;
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

export async function compileBoundaryTiles(): Promise<BoundaryResources> {
	const startedAt = performance.now();
	const only = process.argv
		.find((arg) => arg.startsWith("--only="))
		?.slice(7);
	const manifestPath = join(ROOT, "data/build", TILES_MANIFEST);
	const manifest: BoundaryResources = only
		? parseBoundaryResources(
				JSON.parse(await readFile(manifestPath, "utf8")),
			)
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
	// Keep deployable sidecars with the archives, independent of private topology.
	for (const { asset } of releases) {
		const relativeDirectory = dirname(asset.replace(/^\/data\//, ""));
		const directory = join(ROOT, "data/build", relativeDirectory);
		await mkdir(directory, { recursive: true });
		const propertiesPath = join(
			INTERMEDIATES,
			relativeDirectory,
			"properties.json",
		);
		const temporaryProperties = join(
			directory,
			`properties.${randomUUID()}.tmp`,
		);
		try {
			await link(propertiesPath, temporaryProperties);
			await rename(
				temporaryProperties,
				join(directory, "properties.json"),
			);
		} finally {
			await rm(temporaryProperties, { force: true });
		}
	}
	for (const { key: label, asset } of releases) {
		const started = performance.now();
		const relativeDirectory = dirname(asset.replace(/^\/data\//, ""));
		const directory = join(ROOT, "data/build", relativeDirectory);
		const descriptorPath = join(directory, "resource.json");
		const propertiesPath = join(
			INTERMEDIATES,
			relativeDirectory,
			"properties.json",
		);

		const source = byLabel.get(label);
		const topologyPath = join(
			INTERMEDIATES,
			relativeDirectory,
			"boundaries.topojson",
		);
		const inputs = [
			topologyPath,
			propertiesPath,
			...TILER_SOURCES,
			...(source?.inputs ?? []),
		];
		if (source?.sourcePath && existsSync(source.sourcePath))
			inputs.push(source.sourcePath);
		if (!(await isStale(inputs, descriptorPath))) {
			const cached = JSON.parse(await readFile(descriptorPath, "utf8"));
			const parsed = parseBoundaryResources({
				...manifest,
				releases: { [label]: cached },
			});
			const entry = parsed.releases[label]!;
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
				manifest.releases[label] = entry;
				logArtifact("tiles", label, ["cached", elapsedSince(started)]);
				continue;
			}
		}
		const collection =
			source?.sourcePath && existsSync(source.sourcePath)
				? await correctedSource(
						await readFile(source.sourcePath, "utf8"),
						source,
					)
				: decodeBoundaryData(
						JSON.parse(await readFile(topologyPath, "utf8")),
					);
		const release =
			source ??
			(() => {
				throw new Error(`Missing source metadata for ${label}`);
			})();
		const features = collection.features;
		const areas = areasByCode(features, release.codeKey, label);
		const properties: { features: Record<string, unknown>[] } = JSON.parse(
			await readFile(
				join(INTERMEDIATES, relativeDirectory, "properties.json"),
				"utf8",
			),
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
			JSON.parse(
				await readFile(
					join(dirname(release.topologySourcePath), "meta.json"),
					"utf8",
				),
			),
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
		try {
			const tileset = compileTileset(areas, {
				name: label,
				description: meta.title,
				attribution: `Contains ${meta.publisher} data, ${meta.licence.name}`,
				names,
				gzip: gzipSync,
			});
			assertIds(tileset.ids);
			await writeAtomically(
				join(directory, TILES_FILENAME),
				tileset.archive,
			);
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
			const polygons = decodeBoundaryData(
				JSON.parse(await readFile(topologyPath, "utf8")),
			);
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
			await writeAtomically(
				join(directory, TILES_FILENAME),
				archive.archive,
			);
			entry = {
				method: "compiled-polygons",
				href: asset.replace(/\.topojson$/, ".pmtiles"),
				bytes: archive.archive.length,
				reason: error.message,
			};
		}
		await writeAtomically(descriptorPath, JSON.stringify(entry));
		manifest.releases[label] = entry;
		logArtifact("tiles", label, [
			entry.method,
			formatKb(entry.bytes),
			elapsedSince(started),
		]);
	}
	assertCompleteBoundaryResources(manifest);
	await writeAtomically(
		manifestPath,
		JSON.stringify(manifest, null, "\t") + "\n",
	);
	console.log(
		`Boundary map resources complete (${elapsedSince(startedAt)}).`,
	);
	return manifest;
}

if (process.argv[1]?.endsWith("compile-boundary-tiles.mts"))
	await compileBoundaryTiles();
