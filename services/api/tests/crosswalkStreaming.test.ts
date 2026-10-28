import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compileCrosswalks } from "../../../pipeline/src/crosswalkCompiler";
import type { PropertyCrosswalkAdapter } from "../src/crosswalkAdapters";

const adapter = (id: string): PropertyCrosswalkAdapter => ({
	id,
	input: `${id}.geojson`,
	method: "official-lookup",
	quality: "publisher-supplied",
	weighting: { status: "not-provided" },
	from: {
		geography: "ward",
		boundaryRelease: "old",
		codeProperty: "OLD",
		nameProperty: "OLDNM",
	},
	to: {
		geography: "ward",
		boundaryRelease: "new",
		codeProperty: "NEW",
		nameProperty: "NEWNM",
	},
});

test("yields a complete artifact before reading the next source", () => {
	const root = mkdtempSync(join(tmpdir(), "crosswalk-stream-"));
	try {
		mkdirSync(join(root, "data/source"), { recursive: true });
		const stream = compileCrosswalks(root, [
			adapter("first"),
			adapter("missing"),
		]);
		writeFileSync(
			join(root, "data/source/first.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: {
							OLD: "A",
							OLDNM: "Before",
							NEW: "B",
							NEWNM: "After",
						},
					},
				],
			}),
		);
		const first = stream.next();
		assert.equal(first.done, false);
		assert.equal(first.value.id, "first");
		assert.deepEqual(first.value.records, [
			{
				source: { code: "A", labels: ["Before"] },
				targets: [{ code: "B", labels: ["After"] }],
			},
		]);
		assert.match(first.value.contentHash, /^sha256:[a-f0-9]{64}$/);
		assert.throws(() => stream.next(), /ENOENT/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
