import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readAtlasPayload } from "../shared/atlasSqlite";
import {
	compilePostcodes,
	POSTCODE_GEOGRAPHIES,
	type DeprivationIndex,
	type PostcodeDistricts,
	type PostcodeSectors,
	type SourceDistrict,
} from "../lib/places/postcodes";
import { decodeCompactPayload } from "../lib/data/compactPayload";
import { readSqlitePostcodeAreaShard } from "../services/api/src/atlasPostcodeDerived";
import { postcodeDistrictWhere } from "../services/api/src/atlasPostcodes";
import type {
	PostcodeAreasArtifact,
	PostcodeAreasShard,
} from "../services/api/src/postcodeAreas";
import type { PostcodeIndexArtifact } from "../services/api/src/postcodes";
import { toWgs84Point } from "../services/api/src/reprojection";

export const PLACE_POSTCODES_PATH = join(
	process.cwd(),
	"public",
	"data",
	"datasets",
	"place-postcodes.json",
);

export const PLACE_POSTCODE_SECTORS_PATH = join(
	process.cwd(),
	"public",
	"data",
	"datasets",
	"place-postcode-sectors.json",
);

/** Each index's neighbourhoods, and the field holding their decile. */
const DEPRIVATION: Record<
	DeprivationIndex,
	{ geography: string; year: string; decile: string }
> = {
	imd: { geography: "lsoa", year: "2021", decile: "imdDecile" },
	wimd: { geography: "lsoa", year: "2011", decile: "wimdDecile" },
	simd: { geography: "dataZone", year: "2011", decile: "simdDecile" },
};

/** Each index's deciles by neighbourhood code, from its latest edition. */
function deprivationDeciles(root: string) {
	return Object.entries(DEPRIVATION).map(([index, { decile }]) => {
		const editions = decodeCompactPayload(
			JSON.parse(readAtlasPayload(root, `dataset:${index}`)),
		) as Record<string, { data: Record<string, Record<string, unknown>> }>;
		const latest = Object.entries(editions).sort(
			(a, b) => Number(b[0]) - Number(a[0]),
		)[0]![1];
		const deciles = new Map<string, number>();
		for (const [code, row] of Object.entries(latest.data))
			if (typeof row[decile] === "number")
				deciles.set(code, row[decile] as number);
		return [index as DeprivationIndex, deciles] as const;
	});
}

/** Each postcode district's and sector's postcodes and areas, as each file's text. */
export function serialisePlacePostcodes() {
	const root = process.cwd();
	const apiRoot = join(root, "services/api");
	const index: PostcodeIndexArtifact = JSON.parse(
		readAtlasPayload(root, "postcode-index"),
	);
	const areas: PostcodeAreasArtifact = JSON.parse(
		readAtlasPayload(root, "postcode-areas"),
	);
	// The release a default postcode lookup reads, for each geography.
	const releases = Object.fromEntries(
		POSTCODE_GEOGRAPHIES.map((geography) => {
			const release = areas.releases.find(
				(entry) =>
					entry.geography === geography &&
					entry.purposes.includes("default-lookup"),
			);
			if (!release)
				throw new Error(`No default postcode release for ${geography}`);
			return [geography, `${geography}/${release.boundaryRelease}`];
		}),
	);
	// The release each deprivation index's neighbourhood codes come from.
	const deprivationReleases = Object.entries(DEPRIVATION).map(
		([index, { geography, year }]) => {
			const release = areas.releases.find(
				(entry) =>
					entry.geography === geography &&
					entry.boundaryRelease.startsWith(year),
			);
			if (!release)
				throw new Error(`No ${geography} ${year} postcode release`);
			return `${geography}/${release.boundaryRelease}`;
		},
	);
	const deciles = deprivationDeciles(root);
	const areaShards = new Map(
		areas.shards.map((shard) => [shard.district, shard.path]),
	);
	const database = new DatabaseSync(
		resolve(root, "data/build/atlas.sqlite"),
		{ readOnly: true },
	);
	const select = database.prepare(
		`SELECT postcode, easting, northing, terminated, largeUser FROM postcodes WHERE ${postcodeDistrictWhere} ORDER BY postcode`,
	);

	function* sources(): Generator<SourceDistrict> {
		for (const { district } of index.shards) {
			const path = areaShards.get(district);
			if (!path) continue;
			const shard: PostcodeAreasShard = JSON.parse(
				readSqlitePostcodeAreaShard(apiRoot, path),
			);
			const rows = select.all(
				district,
				`${district}\x7f`,
				district.length + 3,
			);
			yield {
				district,
				postcodes: rows.map((row) => String(row.postcode)),
				grid: rows.flatMap((row) => [
					row.easting === null ? null : Number(row.easting),
					row.northing === null ? null : Number(row.northing),
				]),
				terminated: rows.map((row) => Number(row.terminated)),
				largeUser: rows.map((row) => String(row.largeUser)).join(""),
				areas: Object.fromEntries(
					POSTCODE_GEOGRAPHIES.map((geography) => {
						const column = shard.releases[releases[geography]!];
						if (!column)
							throw new Error(
								`No ${releases[geography]} placements for ${district}`,
							);
						return [geography, column];
					}),
				) as unknown as SourceDistrict["areas"],
				deprivation: rows.map((_, at) => {
					for (const [i, [index, byCode]] of deciles.entries()) {
						const column = shard.releases[deprivationReleases[i]!];
						const position = column?.area[at];
						const code =
							position !== undefined && position >= 0
								? column!.codes[position]
								: undefined;
						const decile = code ? byCode.get(code) : undefined;
						if (decile) return [index, decile] as const;
					}
					return undefined;
				}),
			};
		}
	}

	try {
		const source = {
			title: index.source.title,
			edition: index.source.edition,
			attribution: index.source.attribution,
		};
		const { districts, sectors } = compilePostcodes(
			sources(),
			(easting, northing) => {
				const [lng, lat] = toWgs84Point(
					[easting, northing],
					"EPSG:27700",
				).position;
				return [lng!, lat!];
			},
		);
		return {
			districts: `${JSON.stringify({ source, districts } satisfies PostcodeDistricts)}\n`,
			sectors: `${JSON.stringify({ source, sectors } satisfies PostcodeSectors)}\n`,
		};
	} finally {
		database.close();
	}
}
