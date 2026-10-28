import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ELECTION_SOURCES } from "../../packages/datasets/src/data/election/local-election/config";
import { parseLeapLocalElection } from "../../packages/datasets/src/data/election/local-election/load";
import { withDuckdbLocalElection } from "../../pipeline/src/precompile/duckdbDatasetCsv.mts";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";

const config = ELECTION_SOURCES[2019]!;
if (config.source !== "leap") throw new Error("Expected LEAP source");

test("LEAP selection preserves election results and tracks the original file", async () => {
	const root = await mkdtemp(join(tmpdir(), "duckdb-leap-"));
	try {
		await mkdir(join(root, "politics/elections/local-elections/2019"), {
			recursive: true,
		});
		const csv =
			'"Council","E1","Ward","E05000001","A","Lab","100","1"\n"Council","E1","Ward","E05000001","B","Lab","90","0"\n"Council","E1","Ward","E05000001","C","C","80","0"\n"Scottish","S1","Ward","S05000001","D","SNP","500","1"\n"Welsh","W1","Ward","W05000001","E","Ind","0","1"\n';
		await writeFile(join(root, config.path), csv);
		const { reader, artifacts } = createTrackedReader();
		const actual = await withDuckdbLocalElection(
			reader,
			artifacts,
			async (input) =>
				parseLeapLocalElection(await input.text(config.path), config),
			root,
		);
		assert.deepEqual(actual, parseLeapLocalElection(csv, config));
		assert.equal(
			artifacts.get(`text:${config.path}`)?.sha256,
			createHash("sha256").update(csv).digest("hex"),
		);
		await rm(join(root, config.path));
		await assert.rejects(
			withDuckdbLocalElection(
				reader,
				new Map(),
				(input) => input.text(config.path),
				root,
			),
			{ code: "ENOENT" },
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
