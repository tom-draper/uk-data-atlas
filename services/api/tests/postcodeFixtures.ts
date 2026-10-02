import type { AreaGeometryCache } from "../src/areaGeometry";
import {
	compilePostcodeAreas,
	PostcodeAreaIndex,
	placePoints,
	releaseCounts,
} from "../src/postcodeAreas";
import {
	compilePostcodeIndex,
	parsePostcode,
	PostcodeIndex,
	postcodeLookupPoint,
	type PostcodeShard,
	type PostcodeSource,
	type PostcodeSourceRow,
} from "../src/postcodes";

export const postcodeSource: PostcodeSource = {
	title: "ONS Postcode Directory (August 2026)",
	edition: "2026-08",
	publisher: "Office for National Statistics",
	sourceUrl: "https://example.com/onspd.zip",
	retrieved: "2026-09-25",
	sha256: "sha256:onspd",
	licence: {
		name: "Open Government Licence v3.0",
		url: "https://example.com/ogl",
	},
	attribution: ["Contains OS data © Crown copyright and database right"],
};

export const postcodeRow = (
	pcds: string,
	overrides: Partial<PostcodeSourceRow> = {},
): PostcodeSourceRow => ({
	pcds,
	dointr: "198001",
	doterm: "",
	usrtypind: "0",
	east1m: "530000",
	north1m: "180000",
	gridind: "1",
	ctry: "E92000001",
	...overrides,
});

/** An index over these rows, reading its shards from memory. */
export const postcodeIndexFor = (
	rows: PostcodeSourceRow[],
	options: { includeNorthernIreland?: boolean; capacity?: number } = {},
) => {
	const { artifact, files } = compilePostcodeIndex(
		rows,
		postcodeSource,
		options,
	);
	const texts = new Map(files.map((file) => [file.path, file.text]));
	const reads: string[] = [];
	const index = new PostcodeIndex(
		artifact,
		(path) => {
			reads.push(path);
			return texts.get(path)!;
		},
		options.capacity,
	);
	return { index, artifact, files, texts, reads };
};

/** Every postcode's centroid in shard order, NaN where it has none. */
export const postcodeCentroids = (
	index: PostcodeIndex,
	texts: Map<string, string>,
) => {
	const longitudes: number[] = [];
	const latitudes: number[] = [];
	for (const entry of index.artifact.shards)
		for (const postcode of (
			JSON.parse(texts.get(entry.path)!) as PostcodeShard
		).postcodes) {
			const found = index.lookup(
				parsePostcode(postcode) as Extract<
					ReturnType<typeof parsePostcode>,
					{ kind: "unit" }
				>,
			);
			const point =
				found.status === "found" && found.record.centroid
					? postcodeLookupPoint(found.record.centroid)
					: undefined;
			longitudes.push(point?.lng ?? Number.NaN);
			latitudes.push(point?.lat ?? Number.NaN);
		}
	return {
		longitudes: Float64Array.from(longitudes),
		latitudes: Float64Array.from(latitudes),
	};
};

/**
 * A postcode area index placing an index's postcodes in these releases of a
 * geometry cache, reading its shards from memory.
 */
export const postcodeAreaIndexFor = (
	index: PostcodeIndex,
	texts: Map<string, string>,
	cache: AreaGeometryCache,
	releases: string[],
) => {
	const { longitudes, latitudes } = postcodeCentroids(index, texts);
	const { artifact, files } = compilePostcodeAreas(
		index.artifact,
		releases.map((key) => {
			const [geography, boundaryRelease] = key.split("/") as [
				string,
				string,
			];
			const placements = placePoints(
				longitudes,
				latitudes,
				cache.codes(geography, boundaryRelease),
				(code) => cache.get(geography, boundaryRelease, code),
			);
			return {
				release: {
					geography,
					boundaryRelease,
					purposes: ["default-lookup" as const],
					areaRelease: `sha256:${key}`,
					geometryInput: `sha256:${key}`,
					counts: releaseCounts(
						placements,
						(at) => !Number.isNaN(longitudes[at]!),
					),
				},
				placements,
			};
		}),
	);
	const shardTexts = new Map(files.map((file) => [file.path, file.text]));
	const reads: string[] = [];
	const areaIndex = new PostcodeAreaIndex(artifact, index, (path) => {
		reads.push(path);
		return shardTexts.get(path)!;
	});
	return { areaIndex, artifact, files, shardTexts, reads };
};
