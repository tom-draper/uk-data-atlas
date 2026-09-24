import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { readAreaAdapters } from "../src/areaAdapters";

const read = (manifest: unknown) => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const path = join(directory, "area-adapters.json");
		writeFileSync(path, JSON.stringify(manifest));
		return readAreaAdapters(path);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
};

test("reads release area properties", () => {
	assert.deepEqual(
		read({
			schemaVersion: 1,
			releases: {
				"ward/2025": {
					codeProperty: "WD25CD",
					nameProperty: "WD25NM",
				},
			},
		}),
		{
			"ward/2025": {
				codeProperty: "WD25CD",
				nameProperty: "WD25NM",
			},
		},
	);
});

test("rejects malformed manifests and area-property entries", () => {
	assert.throws(() => read({ schemaVersion: 2, releases: {} }));
	assert.throws(() => read({ schemaVersion: 1, releases: [] }));
	assert.throws(() =>
		read({
			schemaVersion: 1,
			releases: { "ward/2025": { codeProperty: "WD25CD" } },
		}),
	);
});
