/**
 * Converts published boundary GeoJSON into the compact TopoJSON assets served
 * by the application, writing them into data/build/website-boundaries for build-time consumers. The GeoJSON files remain in data/ as reproducible sources, and are the
 * only form of a release this repository commits.
 *
 * Run `node --import tsx scripts/compile-boundaries.mts --force` after changing the compression values
 * below. Preprocessing runs this automatically when a source is newer than
 * its generated TopoJSON asset.
 */
import { createHash } from "crypto";
import { copyFile, mkdir, readFile, stat } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { feature } from "topojson-client";
import { topology } from "topojson-server";
import { presimplify, simplify } from "topojson-simplify";

import type { BoundaryType } from "@uk-data-atlas/datasets/data/boundaries/catalog";
import { boundaryReadsFeatureExtent } from "@uk-data-atlas/datasets/data/boundaries/capabilities";
import { polygonAreaSqKm } from "@uk-data-atlas/datasets/helpers/population";
import {
	buildLog,
	elapsedSince,
	formatBytes,
	formatCount,
	msSince,
} from "@uk-data-atlas/atlas-db";

import {
	PROPERTIES_FILENAME,
	releaseSources,
} from "./geographies/boundaryReleaseSources.ts";
import {
	correctedSource,
	type SourceCorrection,
} from "./geographies/correctBoundarySource.ts";
import {
	exists,
	shouldCompile,
	writeAtomically,
} from "./geographies/boundaryBuildFiles.ts";
export {
	PROPERTIES_FILENAME,
	releaseSources,
} from "./geographies/boundaryReleaseSources.ts";
export type { SubstitutionSource } from "./geographies/boundaryReleaseSources.ts";
export { correctedSource } from "./geographies/correctBoundarySource.ts";
export type { SourceCorrection } from "./geographies/correctBoundarySource.ts";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

// Increase quantization for more positional precision. Increase the minimum
// triangle area for a smaller, less detailed asset.
const QUANTIZATION = 100_000;
const MINIMUM_PLANAR_TRIANGLE_AREA = 0.0000001;

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
type DerivedProperty = (typeof DERIVED_PROPERTIES)[number];

/**
 * The derived values a family's sidecar carries. Area is read for population
 * density wherever a chart aggregates; the extent only by the families a
 * location is reduced to by box (see `boundaryReadsFeatureExtent`), and it is
 * the larger part of what a ward or LSOA sidecar costs to download and parse.
 */
const derivedPropertiesFor = (
	type: BoundaryType,
): readonly DerivedProperty[] =>
	boundaryReadsFeatureExtent(type) ? DERIVED_PROPERTIES : ["areaSqKm"];

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
	derived: readonly DerivedProperty[],
	objectName?: string,
): Record<string, unknown>[] => {
	const object =
		(objectName ? topologyData.objects[objectName] : undefined) ??
		Object.values(topologyData.objects)[0];
	if (!object || object.type !== "GeometryCollection") return [];
	const decoded = feature(topologyData, object);
	const features = decoded.features;
	return features.map((source) => ({
		...source.properties,
		areaSqKm: toPrecision(
			source.geometry ? polygonAreaSqKm(source.geometry as never) : 0,
			7,
		),
		...(derived.includes("bbox") && {
			bbox: featureExtent(source.geometry as never),
		}),
	}));
};

const simplifySource = async (
	raw: string,
	objectName: string,
	keep: ReadonlySet<string>,
	correction: SourceCorrection,
) => {
	const normalised = await correctedSource(raw, correction);
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
		presimplify(
			topology({
				[objectName]: cleaned,
			}) as ReturnType<typeof presimplify>,
		),
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
	derived: readonly DerivedProperty[],
) => {
	for (const key of derived) {
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
	type: BoundaryType,
	topologyData: ReturnType<typeof topology>,
	objectName?: string,
) => {
	const derived = derivedPropertiesFor(type);
	const features = releaseProperties(topologyData, derived, objectName);
	assertDerivedPresent(label, features, derived);
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
export async function compileBoundaryAssets(
	outputDirectory = join(ROOT, "data/build/website-boundaries"),
): Promise<void> {
	const startedAt = performance.now();
	const sources = releaseSources(outputDirectory);
	buildLog.info(
		`Preparing ${formatCount(sources.length)} TopoJSON boundary assets`,
	);
	for (const {
		type,
		label,
		objectName,
		codeKey,
		offsets,
		substitutions,
		reversedOffsets,
		inputs,
		keep,
		sourcePath,
		topologySourcePath,
		outputPath,
		propertiesPath,
	} of sources) {
		const boundaryStartedAt = performance.now();
		if (sourcePath === null) {
			if (!(await exists(topologySourcePath))) {
				buildLog.artifact("boundary", label, {
					status: "skipped, no local GeoJSON or TopoJSON source",
					ms: msSince(boundaryStartedAt),
				});
				continue;
			}
			const topologyChanged = await shouldCompile(
				[topologySourcePath],
				outputPath,
			);
			const propertiesChanged = await shouldCompile(
				[
					topologySourcePath,
					join(
						ROOT,
						"packages/datasets/src/data/boundaries/capabilities.ts",
					),
				],
				propertiesPath,
			);
			if (!topologyChanged && !propertiesChanged) {
				buildLog.artifact("boundary", label, {
					status: "cached",
					bytes: (await stat(outputPath)).size,
					ms: msSince(boundaryStartedAt),
				});
				continue;
			}
			if (topologyChanged) {
				await mkdir(dirname(outputPath), { recursive: true });
				await copyFile(topologySourcePath, outputPath);
			}
			if (propertiesChanged) {
				const topologyData = JSON.parse(
					await readFile(topologySourcePath, "utf8"),
				) as ReturnType<typeof topology>;
				const properties = serializeProperties(
					label,
					type,
					topologyData,
				);
				await writeAtomically(propertiesPath, properties);
				buildLog.artifact("boundary", label, {
					status: "compiled properties from TopoJSON source",
					ms: msSince(boundaryStartedAt),
				});
				buildLog.detail(
					`Boundary ${label}: ${formatBytes(Buffer.byteLength(properties, "utf8"))} properties`,
				);
			}
			continue;
		}

		if (!(await exists(sourcePath))) {
			buildLog.artifact("boundary", label, {
				status: "skipped, local GeoJSON source missing",
				ms: msSince(boundaryStartedAt),
			});
			continue;
		}

		if (
			!(await shouldCompile([sourcePath, ...inputs], outputPath)) &&
			!(await shouldCompile(
				[
					join(
						ROOT,
						"packages/datasets/src/data/boundaries/capabilities.ts",
					),
				],
				propertiesPath,
			))
		) {
			buildLog.artifact("boundary", label, {
				status: "cached",
				bytes: (await stat(outputPath)).size,
				ms: msSince(boundaryStartedAt),
			});
			continue;
		}

		const raw = await readFile(sourcePath, "utf8");
		const topologyData = await simplifySource(raw, objectName, keep, {
			label,
			codeKey,
			offsets,
			substitutions,
			reversedOffsets,
		});
		assertKeptSomething(label, topologyData, keep);
		const output = JSON.stringify(topologyData);
		const properties = serializeProperties(
			label,
			type,
			topologyData,
			objectName,
		);
		await writeAtomically(outputPath, output);
		await writeAtomically(propertiesPath, properties);
		const outputBytes = Buffer.byteLength(output, "utf8");
		const hash = createHash("sha256")
			.update(output)
			.digest("hex")
			.slice(0, 12);
		buildLog.artifact("boundary", label, {
			status: "compiled",
			bytes: outputBytes,
			ms: msSince(boundaryStartedAt),
		});
		buildLog.detail(
			`Boundary ${label}: ${formatBytes(Buffer.byteLength(raw, "utf8"))} source, ${formatBytes(Buffer.byteLength(properties, "utf8"))} properties, hash ${hash}`,
		);
	}
	buildLog.info(
		`Compiled ${formatCount(sources.length)} boundary assets in ${elapsedSince(startedAt)}`,
	);
}

if (process.argv[1]?.endsWith("compile-boundaries.mts")) {
	await compileBoundaryAssets();
}
