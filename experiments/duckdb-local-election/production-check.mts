import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ELECTION_SOURCES } from "../../packages/datasets/src/data/election/local-election/config";
import { parseLeapLocalElection } from "../../packages/datasets/src/data/election/local-election/load";
import { withDuckdbLocalElection } from "../../pipeline/src/precompile/duckdbDatasetCsv.mts";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";

{
	const root = join(process.cwd(), "data/source");
	let checked = 0;
	for (const source of Object.values(ELECTION_SOURCES)) {
		if (source.source !== "leap") continue;
		const original = await readFile(join(root, source.path), "utf8");
		const { reader, artifacts } = createTrackedReader();
		const actual = await withDuckdbLocalElection(
			reader,
			artifacts,
			async (input) =>
				parseLeapLocalElection(await input.text(source.path), source),
			root,
		);
		assert.deepEqual(
			actual,
			parseLeapLocalElection(original, source),
			source.path,
		);
		checked++;
		assert.equal(
			artifacts.get(`text:${source.path}`)?.sha256,
			createHash("sha256").update(original).digest("hex"),
		);
	}
	assert.equal(checked, 4);
	console.log(`Matched ${checked} LEAP source files`);
}
