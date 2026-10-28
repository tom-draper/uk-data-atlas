import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readPostcodeIndex } from "@uk-data-atlas/atlas-runtime/areas";
import { readSqlitePostcodeShard } from "@uk-data-atlas/atlas-runtime/storage";
import type { PostcodeShard } from "@uk-data-atlas/geography/postcode-index-types";
import { apiRootOf } from "@uk-data-atlas/atlas-runtime/storage";

const root = resolve(import.meta.dirname, "..");
const apiRoot = apiRootOf(root);
const index = readPostcodeIndex(apiRoot);
let postcodes = 0;
for (const entry of index.artifact.shards) {
	// The reader verifies the exact reconstructed bytes against the original hash.
	const shard: PostcodeShard = JSON.parse(
		readSqlitePostcodeShard(apiRoot, entry),
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
