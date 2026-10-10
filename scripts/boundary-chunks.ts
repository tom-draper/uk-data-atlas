/**
 * Cuts the large boundary releases into one TopoJSON chunk per region, served
 * beside the release as chunks/<region>.topojson.
 *
 * A location view only draws its own local authorities, yet the whole release
 * is fetched and decoded before the worker discards most of it. Each chunk
 * holds the features of one region, found the way the runtime filter finds
 * them: through the feature's local authority. The runtime then reads only the
 * chunks a location touches and applies the same exact filter to them.
 *
 * Chunks are cut from the compiled topology rather than the source GeoJSON, by
 * choosing geometries and renumbering the arcs they use. Coordinates and the
 * quantisation transform are untouched, so a feature decodes to exactly the
 * coordinates the whole release gives it.
 */
import { createHash } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type { GazetteerCore } from "../lib/data/gazetteer/types";
import { Gazetteer } from "../lib/data/gazetteer/gazetteer";
import { BOUNDARY_CATALOG } from "../lib/data/boundaries/catalog";
import {
	BOUNDARY_CHUNK_TYPES,
	type ChunkedBoundaryType,
} from "../lib/data/boundaries/chunks";
import { lsoaYearForBoundaryAsset } from "../lib/data/boundaries/lsoaLadMappings";
import { getProp } from "../lib/data/boundaries/properties";
import {
	REGION_CHUNK_KEYS,
	regionForLadIn,
} from "../lib/data/datasetRegionChunks";

const publicData = (root: string) => join(root, "public", "data");
const datasetsIn = (root: string) => join(publicData(root), "datasets");

/** Beside the chunks, recording what they were cut from. */
export const CHUNK_INDEX_FILENAME = "index.json";

type Arc = number[][];
type Geometry = {
	type: string;
	arcs?: unknown;
	id?: unknown;
	properties?: Record<string, unknown> | null;
};
type Topology = {
	type: "Topology";
	objects: Record<string, { type: string; geometries: Geometry[] }>;
	arcs: Arc[];
	[key: string]: unknown;
};

type ChunkIndex = {
	version: 1;
	/** Digest of the code that cut the chunks. */
	generator: string;
	/** Digest of the compiled release they were cut from. */
	source: string;
	/** Digest of the gazetteer and lookup that placed each feature. */
	lookups: string;
	regions: Record<string, { features: number; sha256: string }>;
};

const sha256 = (contents: string | Buffer) =>
	createHash("sha256").update(contents).digest("hex");

const digestOfFiles = async (paths: readonly string[]) =>
	sha256(
		(await Promise.all(paths.map((path) => readFile(path))))
			.map((contents) => sha256(contents))
			.join("\n"),
	);

/** The code whose output the chunks are, so changing it recuts them. */
const generatorDigest = (root: string) =>
	digestOfFiles([
		join(root, "scripts", "boundary-chunks.ts"),
		join(root, "lib", "data", "boundaries", "chunks.ts"),
		join(root, "lib", "data", "datasetRegionChunks.ts"),
	]);

type ChunkedRelease = {
	label: string;
	type: ChunkedBoundaryType;
	asset: string;
	topologyPath: string;
	chunkDirectory: string;
	/** The lookup files, besides the gazetteer, that decide each feature's local authority. */
	lookupPaths: string[];
	/** The local authority code each feature of the release belongs to. */
	localAuthority: (
		properties: Record<string, unknown>,
		lookups: Lookups,
	) => string | undefined;
};

type Lookups = {
	wardToLad: Record<string, string>;
	lsoaToLad: Record<string, string>;
};

const releaseDirectory = (root: string, asset: string) =>
	dirname(
		join(
			publicData(root),
			// withCDN appends a version query outside development.
			asset.split("?")[0]!.replace(/^\/data\//, ""),
		),
	);

/**
 * How a feature finds its local authority is exactly how the runtime filter
 * does: a ward by the parent code its release publishes, else the ward lookup;
 * an LSOA by the lookup for its release's year.
 */
const authorityOf = {
	ward: (properties: Record<string, unknown>, { wardToLad }: Lookups) => {
		const code = getProp(properties, BOUNDARY_CATALOG.ward.properties.code);
		return (
			getProp(
				properties,
				BOUNDARY_CATALOG.ward.properties.parentCode ??
					BOUNDARY_CATALOG.localAuthority.properties.code,
			) || (code ? wardToLad[code] : undefined)
		);
	},
	lsoa: (properties: Record<string, unknown>, { lsoaToLad }: Lookups) => {
		const code = getProp(properties, BOUNDARY_CATALOG.lsoa.properties.code);
		return code ? lsoaToLad[code] : undefined;
	},
} satisfies Record<
	ChunkedBoundaryType,
	(
		properties: Record<string, unknown>,
		lookups: Lookups,
	) => string | undefined
>;

export const chunkedReleases = (root: string): ChunkedRelease[] =>
	BOUNDARY_CHUNK_TYPES.flatMap((type) =>
		BOUNDARY_CATALOG[type].releases.flatMap((release) => {
			if (!release.asset) return [];
			const directory = releaseDirectory(root, release.asset);
			const lsoaYear = lsoaYearForBoundaryAsset(release.asset);
			// A release no vintage serves (the Wales-only 2011 LSOAs) is never
			// fetched for a location, and has no lookup to place its features.
			if (type === "lsoa" && lsoaYear === undefined) return [];
			return [
				{
					label: `${type}/${release.id}`,
					type,
					asset: release.asset,
					topologyPath: join(directory, "boundaries.topojson"),
					chunkDirectory: join(directory, "chunks"),
					lookupPaths: [
						join(
							datasetsIn(root),
							type === "ward"
								? "boundary-mappings.json"
								: `lsoa-lad-mappings-${lsoaYear}.json`,
						),
					],
					localAuthority: authorityOf[type],
				},
			];
		}),
	);

/**
 * The geometries chosen by `keep`, with the arcs they use renumbered from
 * zero. A geometry with no numeric id is given its position in the release,
 * which is the id the decoder would give it, so a chunk's ids always agree
 * with the whole release's.
 */
export const subsetTopology = (
	topology: Topology,
	objectName: string,
	keep: (geometry: Geometry, index: number) => boolean,
): Topology => {
	const object = topology.objects[objectName]!;
	const renumbered = new Map<number, number>();
	const arcs: Arc[] = [];
	const remap = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(remap);
		const index =
			(value as number) < 0 ? ~(value as number) : (value as number);
		let target = renumbered.get(index);
		if (target === undefined) {
			target = arcs.length;
			renumbered.set(index, target);
			arcs.push(topology.arcs[index]!);
		}
		return (value as number) < 0 ? ~target : target;
	};
	const geometries = object.geometries.flatMap((geometry, index) =>
		keep(geometry, index)
			? [
					{
						...geometry,
						id:
							typeof geometry.id === "number"
								? geometry.id
								: index + 1,
						...(geometry.arcs === undefined
							? {}
							: { arcs: remap(geometry.arcs) }),
					},
				]
			: [],
	);
	return {
		...topology,
		objects: { [objectName]: { ...object, geometries } },
		arcs,
	};
};

const writeIfChanged = async (path: string, contents: string) => {
	if (existsSync(path) && (await readFile(path, "utf8")) === contents) return;
	await mkdir(dirname(path), { recursive: true });
	const temporaryPath = `${path}.${process.pid}.tmp`;
	await writeFile(temporaryPath, contents);
	await rename(temporaryPath, path);
};

const regionFileName = (region: string) => `${region}.topojson`;

/** What the chunks of a release should be stamped with right now. */
const expectedStamp = async (
	root: string,
	release: ChunkedRelease,
	generator: string,
) => ({
	generator,
	source: await digestOfFiles([release.topologyPath]),
	lookups: await digestOfFiles([
		join(datasetsIn(root), "gazetteer.core.json"),
		...release.lookupPaths,
	]),
});

const readIndex = async (
	release: ChunkedRelease,
): Promise<ChunkIndex | undefined> => {
	try {
		return JSON.parse(
			await readFile(
				join(release.chunkDirectory, CHUNK_INDEX_FILENAME),
				"utf8",
			),
		) as ChunkIndex;
	} catch {
		return undefined;
	}
};

/**
 * Cuts every chunked release into region chunks, leaving alone any release
 * whose chunks already came from the same release, lookups and code.
 */
export async function compileBoundaryChunks(root: string): Promise<void> {
	const startedAt = performance.now();
	const datasets = datasetsIn(root);
	const generator = await generatorDigest(root);
	const gazetteer = new Gazetteer(
		JSON.parse(
			await readFile(join(datasets, "gazetteer.core.json"), "utf8"),
		) as GazetteerCore,
	);
	const wardToLad = (
		JSON.parse(
			await readFile(join(datasets, "boundary-mappings.json"), "utf8"),
		) as { wardToLad: Record<string, string> }
	).wardToLad;

	let cut = 0;
	let kept = 0;
	for (const release of chunkedReleases(root)) {
		const stamp = await expectedStamp(root, release, generator);
		const existing = await readIndex(release);
		if (
			existing &&
			existing.generator === stamp.generator &&
			existing.source === stamp.source &&
			existing.lookups === stamp.lookups
		) {
			kept += 1;
			continue;
		}

		const lookups: Lookups = {
			wardToLad,
			lsoaToLad:
				release.type === "lsoa"
					? (
							JSON.parse(
								await readFile(release.lookupPaths[0]!, "utf8"),
							) as { lsoaToLad: Record<string, string> }
						).lsoaToLad
					: {},
		};
		const topology = JSON.parse(
			await readFile(release.topologyPath, "utf8"),
		) as Topology;
		const objectName = Object.keys(topology.objects)[0]!;
		const regionOf = topology.objects[objectName]!.geometries.map(
			(geometry) => {
				const ladCode = release.localAuthority(
					geometry.properties ?? {},
					lookups,
				);
				return ladCode ? regionForLadIn(gazetteer, ladCode) : null;
			},
		);

		const regions: ChunkIndex["regions"] = {};
		for (const region of REGION_CHUNK_KEYS) {
			const chunk = subsetTopology(
				topology,
				objectName,
				(_geometry, index) => regionOf[index] === region,
			);
			const json = JSON.stringify(chunk);
			await writeIfChanged(
				join(release.chunkDirectory, regionFileName(region)),
				json,
			);
			regions[region] = {
				features: chunk.objects[objectName]!.geometries.length,
				sha256: sha256(json),
			};
		}
		await writeIfChanged(
			join(release.chunkDirectory, CHUNK_INDEX_FILENAME),
			JSON.stringify({
				version: 1,
				...stamp,
				regions,
			} satisfies ChunkIndex),
		);
		cut += 1;
	}
	console.log(
		`Boundary chunks: ${cut} cut, ${kept} unchanged (${Math.round(performance.now() - startedAt)} ms).`,
	);
}

/**
 * What is wrong with the committed chunks: a release without any, chunks cut
 * from a different release, lookups or generator, or a chunk file edited or
 * missing. Empty when the chunks are exactly what compiling would write.
 */
export async function boundaryChunkProblems(root: string): Promise<string[]> {
	const generator = await generatorDigest(root);
	const problems: string[] = [];
	for (const release of chunkedReleases(root)) {
		const index = await readIndex(release);
		if (!index) {
			problems.push(`${release.label} has no region chunks.`);
			continue;
		}
		const stamp = await expectedStamp(root, release, generator);
		if (
			index.generator !== stamp.generator ||
			index.source !== stamp.source ||
			index.lookups !== stamp.lookups
		) {
			problems.push(
				`${release.label} region chunks were cut from different inputs.`,
			);
			continue;
		}
		for (const region of REGION_CHUNK_KEYS) {
			const path = join(release.chunkDirectory, regionFileName(region));
			const recorded = index.regions[region];
			if (
				!recorded ||
				!existsSync(path) ||
				sha256(await readFile(path)) !== recorded.sha256
			)
				problems.push(
					`${release.label} chunk ${region} does not match its index.`,
				);
		}
	}
	return problems;
}
