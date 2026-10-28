import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readAtlasPayload } from "@uk-data-atlas/atlas-runtime/storage";
import {
	compilePostcodes,
	DEPRIVATION,
	DEPRIVATION_INDICES,
	POSTCODE_GEOGRAPHIES,
	postcodeReleases,
	type DeprivationIndex,
	type PlaceNeighbourhoods,
	type PostcodeDistricts,
	type PostcodeSectors,
	type SourceDistrict,
} from "../lib/places/postcodes";
import { decodeCompactPayload } from "../lib/data/compactPayload";
import { readSqlitePostcodeAreaShard } from "@uk-data-atlas/atlas-runtime/storage";
import { postcodeDistrictWhere } from "@uk-data-atlas/atlas-runtime/storage";
import type {
	PostcodeAreasArtifact,
	PostcodeAreasShard,
} from "@uk-data-atlas/atlas-runtime/postcodes";
import type { PostcodeIndexArtifact } from "@uk-data-atlas/geography/postcode-index-types";
import { toWgs84Point } from "@uk-data-atlas/geography/coordinates";
import { apiRootOf } from "@uk-data-atlas/atlas-runtime/storage";

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

export const PLACE_NEIGHBOURHOODS_PATH = join(
	process.cwd(),
	"public",
	"data",
	"datasets",
	"place-neighbourhoods.json",
);

/** Each index's neighbourhoods, from its latest edition. */
function compileNeighbourhoods(root: string) {
	return Object.fromEntries(
		DEPRIVATION_INDICES.map((index) => {
			const { name, rank, decile } = DEPRIVATION[index];
			const editions = decodeCompactPayload(
				JSON.parse(readAtlasPayload(root, `dataset:${index}`)),
			) as Record<
				string,
				{ data: Record<string, Record<string, unknown>> }
			>;
			const [edition, latest] = Object.entries(editions).sort(
				(a, b) => Number(b[0]) - Number(a[0]),
			)[0]!;
			const rows = Object.values(latest.data);
			const areas: PlaceNeighbourhoods[DeprivationIndex]["areas"] = {};
			for (const [code, row] of Object.entries(latest.data))
				if (
					typeof row[rank] === "number" &&
					typeof row[decile] === "number"
				)
					areas[code] = [
						String(row[name] ?? code),
						row[rank] as number,
						row[decile] as number,
					];
			return [index, { edition, total: rows.length, areas }];
		}),
	) as PlaceNeighbourhoods;
}

/**
 * Each postcode district's and sector's postcodes and areas, and each
 * deprivation index's neighbourhoods, as each file's text.
 */
export function serialisePlacePostcodes() {
	const root = process.cwd();
	const apiRoot = apiRootOf(root);
	const index: PostcodeIndexArtifact = JSON.parse(
		readAtlasPayload(root, "postcode-index"),
	);
	const areas: PostcodeAreasArtifact = JSON.parse(
		readAtlasPayload(root, "postcode-areas"),
	);
	const { areas: releases, deprivation: deprivationReleases } =
		postcodeReleases(areas.releases);
	const neighbourhoods = compileNeighbourhoods(root);
	const deciles = DEPRIVATION_INDICES.map(
		(index) =>
			[
				index,
				new Map(
					Object.entries(neighbourhoods[index].areas).map(
						([code, [, , decile]]) => [code, decile],
					),
				),
			] as const,
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
						const column = shard.releases[releases[geography]];
						if (!column)
							throw new Error(
								`No ${releases[geography]} placements for ${district}`,
							);
						return [geography, column];
					}),
				) as unknown as SourceDistrict["areas"],
				deprivation: rows.map((_, at) => {
					for (const [index, byCode] of deciles) {
						const column =
							shard.releases[deprivationReleases[index]];
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
			neighbourhoods: `${JSON.stringify(neighbourhoods)}\n`,
		};
	} finally {
		database.close();
	}
}
