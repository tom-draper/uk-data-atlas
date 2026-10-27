import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readAtlasPayload } from "../shared/atlasSqlite";
import {
	buildArtifactPath,
	geographyCatalogues,
} from "../shared/geographyBuildPath";

const root = resolve(import.meta.dirname, "..");
for (const id of geographyCatalogues)
	assert.equal(
		readAtlasPayload(root, id),
		readFileSync(buildArtifactPath(root, `${id}.json`), "utf8"),
		id,
	);
console.log(
	`Matched ${geographyCatalogues.length} geography catalogue payloads byte for byte.`,
);
