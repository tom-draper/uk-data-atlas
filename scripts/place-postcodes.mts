import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readAtlasPayload } from "../shared/atlasSqlite";
import {
	compilePostcodeDistricts,
	POSTCODE_GEOGRAPHIES,
	type PostcodeDistricts,
	type SourceDistrict,
} from "../lib/places/postcodes";
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

/** Each postcode district's postcodes and areas, as the file's text. */
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
			};
		}
	}

	try {
		const compiled: PostcodeDistricts = {
			source: {
				title: index.source.title,
				edition: index.source.edition,
				attribution: index.source.attribution,
			},
			districts: compilePostcodeDistricts(
				sources(),
				(easting, northing) => {
					const [lng, lat] = toWgs84Point(
						[easting, northing],
						"EPSG:27700",
					).position;
					return [lng!, lat!];
				},
			),
		};
		return `${JSON.stringify(compiled)}\n`;
	} finally {
		database.close();
	}
}
