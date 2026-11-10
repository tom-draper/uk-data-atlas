import {
	readSqlitePostcodeShard,
	readSqlitePostcodeIndex as readPostcodeIndex,
} from "@uk-data-atlas/postcodes";

import { parsePostcode } from "@uk-data-atlas/geography";
import type { PostcodeShard } from "@uk-data-atlas/geography";
import { postcodeLookupPoint } from "@uk-data-atlas/postcodes";
import { join } from "node:path";

/**
 * Every postcode's centroid in the postcode index, in shard order, as shared
 * arrays a worker can read. A postcode with no centroid is NaN.
 */
export const readPostcodeCoordinates = (repositoryRoot: string) => {
	const databasePath = join(
		repositoryRoot,
		"data/build/postcode-index.sqlite",
	);
	const postcodeIndex = readPostcodeIndex(repositoryRoot, databasePath);
	const postcodeArtifact = postcodeIndex.artifact;
	const count = postcodeArtifact.counts.postcodes;
	const longitudes = new SharedArrayBuffer(count * 8);
	const latitudes = new SharedArrayBuffer(count * 8);
	const lng = new Float64Array(longitudes).fill(Number.NaN);
	const lat = new Float64Array(latitudes).fill(Number.NaN);
	let at = 0;
	for (const entry of postcodeArtifact.shards) {
		const shard = JSON.parse(
			readSqlitePostcodeShard(repositoryRoot, entry, databasePath),
		) as PostcodeShard;
		for (const postcode of shard.postcodes) {
			const found = postcodeIndex.lookup(
				parsePostcode(postcode) as Extract<
					ReturnType<typeof parsePostcode>,
					{ kind: "unit" }
				>,
			);
			if (found.status === "found" && found.record.centroid) {
				const point = postcodeLookupPoint(found.record.centroid);
				lng[at] = point.lng;
				lat[at] = point.lat;
			}
			at += 1;
		}
	}
	if (at !== count)
		throw new Error(
			`The postcode index counts ${count} postcodes but holds ${at}.`,
		);
	return { postcodeArtifact, lng, lat, longitudes, latitudes };
};
