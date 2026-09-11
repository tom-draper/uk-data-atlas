/**
 * Converts published boundary GeoJSON into the compact TopoJSON assets served
 * by the application, writing them into public/data where they are served
 * from. The GeoJSON files remain in data/ as reproducible sources, and are the
 * only form of a release this repository commits.
 *
 * Run `pnpm boundaries:compile --force` after changing the compression values
 * below. Preprocessing runs this automatically when a source is newer than
 * its generated TopoJSON asset.
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { mkdir, readFile, rename, stat, writeFile } from "fs/promises";
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
import {
	applyGridOffset,
	parseGridOffset,
	type GridOffset,
} from "../lib/data/boundaries/gridOffset";
import { parseDatasetMeta } from "../lib/data/catalog/meta";
import { polygonAreaSqKm } from "../lib/helpers/population";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Served beside each release's boundaries.topojson. */
export const PROPERTIES_FILENAME = "properties.json";

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
const readReleaseMeta = (releaseDir: string) =>
	parseDatasetMeta(
		JSON.parse(readFileSync(join(releaseDir, "meta.json"), "utf8")),
		basename(releaseDir),
	);

/**
 * The corrections a release's meta.json declares, loaded from their
 * definitions in data/boundaries/, with the paths that define them so a
 * change to either recompiles the release.
 */
const correctionsFromMeta = (releaseDir: string) =>
	(readReleaseMeta(releaseDir).corrections ?? []).map((id) => {
		const path = join(ROOT, "data", "boundaries", `${id}.json`);
		return {
			path,
			offset: parseGridOffset(
				JSON.parse(readFileSync(path, "utf8")),
				path,
			),
		};
	});

const sourceFromMeta = (releaseDir: string, label: string): string | null => {
	const meta = readReleaseMeta(releaseDir);
	const sources = meta.files.filter(
		(file) =>
			file.path.endsWith(".geojson") &&
			(file.role === "source" || file.role === "derived"),
	);
	// A release published only as TopoJSON, or converted outside this repo,
	// lists no GeoJSON at all. Its geometry remains unreproducible here, but
	// the caller can still derive a properties sidecar from that topology.
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
			// The release folder in data/ holds the meta and the published
			// GeoJSON; the compiled asset is written straight to where it is
			// served from, rather than into data/ and copied across after.
			const releaseDir = dirname(join(ROOT, "data", relative));
			const outputPath = join(ROOT, "public", "data", relative);
			const corrections = correctionsFromMeta(releaseDir);
			return [
				{
					label: `${type}/${release.id}`,
					objectName: type,
					codeKey: release.codeKey,
					offsets: corrections.map(({ offset }) => offset),
					// The meta and any correction it declares change the output as
					// surely as the source does.
					inputs: [
						join(releaseDir, "meta.json"),
						...corrections.map(({ path }) => path),
					],
					keep: new Set<string>([
						release.codeKey,
						release.nameKey,
						...(release.parentCodeKey
							? [release.parentCodeKey]
							: []),
					]),
					sourcePath: sourceFromMeta(
						releaseDir,
						`${type}/${release.id}`,
					),
					// A small number of releases are held only as TopoJSON. They
					// cannot be recompiled, but their existing topology is enough to
					// derive the sidecar the runtime reads.
					topologySourcePath: join(ROOT, "data", relative),
					outputPath,
					propertiesPath: join(
						dirname(outputPath),
						PROPERTIES_FILENAME,
					),
				},
			];
		}),
	).sort((a, b) => a.label.localeCompare(b.label));

const writeAtomically = async (path: string, contents: string) => {
	// public/data is not committed, so the release folder may not exist yet.
	await mkdir(dirname(path), { recursive: true });
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

const shouldCompile = async (inputPaths: string[], outputPath: string) => {
	if (process.argv.includes("--force")) return true;
	try {
		const [output, ...inputs] = await Promise.all(
			[outputPath, ...inputPaths].map((path) => stat(path)),
		);
		return inputs.some((input) => input.mtimeMs > output!.mtimeMs);
	} catch {
		return true;
	}
};

/**
 * The properties sidecar written beside each compiled release.
 *
 * Every chart aggregates over its own vintage, but none of them read a
 * coordinate: `filterFeatures` and the reducers key off the code properties
 * alone, and a hover is a dataset lookup. The only runtime readers of geometry
 * are the map, which draws one vintage at a time, and two derived values —
 * area, for population density, and extent, for fitting the map to an area.
 *
 * Deriving those two here and serving the properties on their own means a
 * vintage a chart merely aggregates over costs a few hundred KB instead of
 * several MB, and never puts a coordinate on the heap. A boundary file is
 * ~99% coordinates, and only the vintage being drawn needs them.
 *
 * The derived values are computed from the finished topology rather than from
 * the source, so a value read off the sidecar is the one the runtime would
 * have computed from the asset it was served.
 */
const DERIVED_PROPERTIES = ["areaSqKm", "bbox"] as const;

/** One record per feature, in the order the topology lists them. */
export type BoundaryPropertiesFile = {
	release: string;
	features: Record<string, unknown>[];
};

const round = (value: number, places: number) => {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
};

// Significant figures rather than decimal places, so the relative error is the
// same for a City of London ward and a Highland one. Fixed places cost the
// smallest areas most: at four places, 0.0693 km² is out by 0.06%.
const toPrecision = (value: number, figures: number) =>
	value === 0 ? 0 : Number(value.toPrecision(figures));

const featureExtent = (
	geometry: { coordinates: unknown } | null,
): [number, number, number, number] | undefined => {
	if (!geometry) return undefined;
	let west = Infinity,
		south = Infinity,
		east = -Infinity,
		north = -Infinity;
	const walk = (coordinates: unknown): void => {
		if (!Array.isArray(coordinates)) return;
		if (typeof coordinates[0] === "number") {
			const [longitude, latitude] = coordinates as number[];
			west = Math.min(west, longitude!);
			east = Math.max(east, longitude!);
			south = Math.min(south, latitude!);
			north = Math.max(north, latitude!);
			return;
		}
		for (const part of coordinates) walk(part);
	};
	walk(geometry.coordinates);
	if (west === Infinity) return undefined;
	// Four places is a little over a metre, far below what fitting a map to an
	// area can show, and four fewer characters per number across every feature.
	return [round(west, 4), round(south, 4), round(east, 4), round(north, 4)];
};

/** The published properties of each feature, plus the two derived values. */
const releaseProperties = (
	topologyData: ReturnType<typeof topology>,
	objectName?: string,
): Record<string, unknown>[] => {
	const object =
		(objectName ? topologyData.objects[objectName] : undefined) ??
		Object.values(topologyData.objects)[0];
	if (!object || object.type !== "GeometryCollection") return [];
	const decoded = feature(topologyData, object);
	const features =
		decoded.type === "FeatureCollection" ? decoded.features : [decoded];
	return features.map((source) => ({
		...source.properties,
		areaSqKm: toPrecision(
			source.geometry ? polygonAreaSqKm(source.geometry as never) : 0,
			7,
		),
		bbox: featureExtent(source.geometry as never),
	}));
};

const simplifySource = (
	raw: string,
	objectName: string,
	keep: ReadonlySet<string>,
	correction: { label: string; codeKey: string; offsets: GridOffset[] },
) => {
	// Corrections work in the publisher's grid, so they run before decoding
	// reprojects it.
	const normalised = decodeBoundaryData(
		correction.offsets.reduce(
			(collection, offset) =>
				applyGridOffset(
					collection,
					offset,
					correction.codeKey,
					correction.label,
				),
			JSON.parse(raw),
		),
	);
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

/**
 * A sidecar that would not stand in for the geometry it replaces. The whole
 * point of the file is that nothing downstream needs the coordinates, so a
 * derived value silently missing would put them back on the critical path.
 */
const assertDerivedPresent = (
	label: string,
	features: Record<string, unknown>[],
) => {
	for (const key of DERIVED_PROPERTIES) {
		if (features.every((record) => record[key] === undefined)) {
			throw new Error(
				`${label}: no feature carries a ${key}, so the properties file ` +
					`cannot stand in for the geometry.`,
			);
		}
	}
};

const serializeProperties = (
	label: string,
	topologyData: ReturnType<typeof topology>,
	objectName?: string,
) => {
	const features = releaseProperties(topologyData, objectName);
	assertDerivedPresent(label, features);
	return JSON.stringify({
		release: label,
		features,
	} satisfies BoundaryPropertiesFile);
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

/** Compiles GeoJSON releases and derives properties for every served release. */
export async function compileBoundaryAssets(): Promise<void> {
	const sources = releaseSources();
	console.log(
		`Preparing TopoJSON boundary assets (${sources.length} releases)...`,
	);
	for (const {
		label,
		objectName,
		codeKey,
		offsets,
		inputs,
		keep,
		sourcePath,
		topologySourcePath,
		outputPath,
		propertiesPath,
	} of sources) {
		if (sourcePath === null) {
			if (!(await exists(topologySourcePath))) {
				console.log(
					`  boundary: ${label} (no local GeoJSON or TopoJSON source, skipped)`,
				);
				continue;
			}
			if (!(await shouldCompile([topologySourcePath], propertiesPath))) {
				console.log(`  boundary: ${label} (properties up to date)`);
				continue;
			}

			const topologyData = JSON.parse(
				await readFile(topologySourcePath, "utf8"),
			) as ReturnType<typeof topology>;
			const properties = serializeProperties(label, topologyData);
			await writeAtomically(propertiesPath, properties);
			const propertiesKb = Math.round(
				Buffer.byteLength(properties, "utf8") / 1024,
			);
			console.log(
				`  boundary: ${label} (TopoJSON source -> ${propertiesKb} KB properties)`,
			);
			continue;
		}

		if (!(await exists(sourcePath))) {
			console.log(
				`  boundary: ${label} (local GeoJSON source missing, skipped)`,
			);
			continue;
		}

		if (
			!(await shouldCompile([sourcePath, ...inputs], outputPath)) &&
			(await exists(propertiesPath))
		) {
			console.log(`  boundary: ${label} (up to date)`);
			continue;
		}

		const raw = await readFile(sourcePath, "utf8");
		const topologyData = simplifySource(raw, objectName, keep, {
			label,
			codeKey,
			offsets,
		});
		assertKeptSomething(label, topologyData, keep);
		const output = JSON.stringify(topologyData);
		const properties = serializeProperties(label, topologyData, objectName);
		await writeAtomically(outputPath, output);
		await writeAtomically(propertiesPath, properties);
		const sourceKb = Math.round(Buffer.byteLength(raw, "utf8") / 1024);
		const outputKb = Math.round(Buffer.byteLength(output, "utf8") / 1024);
		const propertiesKb = Math.round(
			Buffer.byteLength(properties, "utf8") / 1024,
		);
		const hash = createHash("sha256")
			.update(output)
			.digest("hex")
			.slice(0, 12);
		console.log(
			`  boundary: ${label} (${sourceKb} KB -> ${outputKb} KB + ${propertiesKb} KB properties, ${hash})`,
		);
	}
}

if (process.argv[1]?.endsWith("compile-boundaries.mts")) {
	await compileBoundaryAssets();
}
