import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readCachePayload } from "@uk-data-atlas/atlas-runtime/storage";
import { createLocationProjectionStore } from "@uk-data-atlas/atlas-runtime/places";
import type {
	LocationProjectionInventory,
	LocationProjectionArtifact,
	LocationParentProjectionArtifact,
} from "@uk-data-atlas/atlas-runtime/places";
import { readStoredText } from "@uk-data-atlas/artifacts";
import { apiRootOf } from "@uk-data-atlas/atlas-runtime/storage";

const root = resolve(import.meta.dirname, "..");
const apiRoot = apiRootOf(root);
const projectionDirectory = join(root, "data/build/location-projections");
const text = readFileSync(
	join(projectionDirectory, "location-projection-inventory.json"),
	"utf8",
);
assert.deepEqual(
	JSON.parse(
		readCachePayload(
			apiRoot,
			"projections",
			"location-projection-inventory",
		),
	),
	JSON.parse(text),
);
const inventory: LocationProjectionInventory = JSON.parse(text);
const database = createLocationProjectionStore(apiRoot, inventory);
let members = 0;
let parents = 0;
for (const shard of inventory.shards) {
	const artifact: LocationProjectionArtifact = JSON.parse(
		readStoredText(join(projectionDirectory, shard.artifact)),
	);
	for (const projection of artifact.projections) {
		assert.equal(
			JSON.stringify(
				database.get(
					projection.locationId,
					projection.geography,
					projection.boundaryRelease,
					shard.crosswalkId,
				),
			),
			JSON.stringify(projection),
		);
		members += 1;
	}
}
for (const shard of inventory.parentShards) {
	const artifact: LocationParentProjectionArtifact = JSON.parse(
		readStoredText(join(projectionDirectory, shard.artifact)),
	);
	for (const projection of artifact.parentProjections) {
		assert.equal(
			JSON.stringify(
				database.parents(projection.locationId, shard.crosswalkId),
			),
			JSON.stringify(projection),
		);
		parents += 1;
	}
}
assert.ok(members > 0 && parents > 0);
console.log(
	`Matched ${members} member projections and ${parents} parent projections byte for byte against release shards.`,
);
