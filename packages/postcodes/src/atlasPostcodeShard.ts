import { sha256 } from "@uk-data-atlas/artifacts";
import type {
	PostcodeIndexArtifact,
	PostcodeShard,
} from "@uk-data-atlas/geography";
import { atlasDatabasePath } from "@uk-data-atlas/atlas-db";
import { openReadOnlyDatabase } from "@uk-data-atlas/atlas-db";

export const postcodeFields = [
	"postcode",
	"easting",
	"northing",
	"quality",
	"country",
	"introduced",
	"terminated",
	"large_user",
];
export const postcodeDistrictWhere =
	"postcode >= ? AND postcode < ? AND length(postcode) = ?";

/** Reconstruct the compiler's exact shard bytes while retaining positional joins. */
export const readSqlitePostcodeShard = (
	repositoryRoot: string,
	entry: PostcodeIndexArtifact["shards"][number],
	databasePath = atlasDatabasePath(repositoryRoot),
	collectPoints?: (points: Array<[number, number] | null>) => void,
): string => {
	const database = openReadOnlyDatabase(databasePath);
	try {
		const rows = database
			.prepare(
				`SELECT ${postcodeFields.join(", ")}${collectPoints ? ", latitude_microdegrees, longitude_microdegrees" : ""} FROM postcode WHERE ${postcodeDistrictWhere} ORDER BY postcode`,
			)
			.all(
				entry.district,
				`${entry.district}\x7f`,
				entry.district.length + 3,
			);
		if (collectPoints) {
			const coordinates = rows.flatMap((row) => [
				row.latitude_microdegrees,
				row.longitude_microdegrees,
			]);
			const expected = database
				.prepare(
					"SELECT coordinates_sha256 FROM postcode_area_shard_hash WHERE district = ?",
				)
				.get(entry.district)?.coordinates_sha256;
			if (expected !== sha256(JSON.stringify(coordinates)))
				throw new Error(
					`Invalid SQLite postcode coordinates for district ${entry.district}`,
				);
			collectPoints(
				rows.map((row) =>
					row.latitude_microdegrees == null ||
					row.longitude_microdegrees == null
						? null
						: [
								Number(row.longitude_microdegrees) / 1e6,
								Number(row.latitude_microdegrees) / 1e6,
							],
				),
			);
		}
		const shard: PostcodeShard = {
			schemaVersion: 1,
			district: entry.district,
			postcodes: rows.map((row) => String(row.postcode)),
			grid: rows.flatMap((row) => [
				row.easting === null ? null : Number(row.easting),
				row.northing === null ? null : Number(row.northing),
			]),
			quality: rows.map((row) => String(row.quality)).join(""),
			country: rows.map((row) => String(row.country)).join(""),
			introduced: rows.map((row) => Number(row.introduced)),
			terminated: rows.map((row) => Number(row.terminated)),
			largeUser: rows.map((row) => String(row.large_user)).join(""),
		};
		const text = `${JSON.stringify(shard)}\n`;
		if (
			rows.length !== entry.postcodes ||
			sha256(text) !== entry.contentHash
		)
			throw new Error(
				`Invalid SQLite postcode district ${entry.district}`,
			);
		return text;
	} finally {
		database.release();
	}
};
