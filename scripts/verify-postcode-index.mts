import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readPostcodeIndex } from "@uk-data-atlas/atlas-runtime/loader";
import { readSqlitePostcodeShard } from "@uk-data-atlas/postcodes";
import type { PostcodeShard } from "@uk-data-atlas/geography/postcode-index-types";

const root = resolve(import.meta.dirname, "..");
const index = readPostcodeIndex(root);
let postcodes = 0;
for (const entry of index.artifact.shards) {
	// The reader verifies the exact reconstructed bytes against the original hash.
	const shard: PostcodeShard = JSON.parse(
		readSqlitePostcodeShard(root, entry),
	);
	postcodes += shard.postcodes.length;
	for (const at of new Set([0, shard.postcodes.length - 1])) {
		const postcode = shard.postcodes[at];
		if (postcode)
			assert.deepEqual(index.position(postcode), {
				district: entry.district,
				at,
			});
	}
}
assert.equal(postcodes, index.artifact.counts.postcodes);
const database = new DatabaseSync(join(root, "data/build/atlas.sqlite"), {
	readOnly: true,
});
try {
	assert.equal(
		database.prepare("SELECT count(*) AS total FROM postcodes").get()
			?.total,
		postcodes,
	);
} finally {
	database.close();
}
console.log(
	`Verified all ${postcodes} postcodes across ${index.artifact.shards.length} districts, exact shard hashes and positional joins.`,
);
