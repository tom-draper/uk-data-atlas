import { DatabaseSync } from "node:sqlite";
import { sha256 } from "@uk-data-atlas/artifacts";
import type {
	PostcodeIndexArtifact,
	PostcodeShard,
} from "@uk-data-atlas/geography/postcode-index-types";
import { atlasDatabasePath } from "./dataLayout";

export const postcodeFields = [
	"postcode",
	"easting",
	"northing",
	"quality",
	"country",
	"introduced",
	"terminated",
	"largeUser",
];
export const postcodeDistrictWhere =
	"postcode >= ? AND postcode < ? AND length(postcode) = ?";

/** Reconstruct the compiler's exact shard bytes while retaining positional joins. */
export const readSqlitePostcodeShard = (
	apiRoot: string,
	entry: PostcodeIndexArtifact["shards"][number],
): string => {
	const database = new DatabaseSync(atlasDatabasePath(apiRoot), {
		readOnly: true,
	});
	try {
		const rows = database
			.prepare(
				`SELECT ${postcodeFields.join(", ")} FROM postcodes WHERE ${postcodeDistrictWhere} ORDER BY postcode`,
			)
			.all(
				entry.district,
				`${entry.district}\x7f`,
				entry.district.length + 3,
			);
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
			largeUser: rows.map((row) => String(row.largeUser)).join(""),
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
		database.close();
	}
};
