import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { trackDuckdbSource } from "../../pipeline/src/precompile/duckdbSource.mts";

test("tracks source bytes and rejects a source changed during processing", async () => {
	const dir = await mkdtemp(join(tmpdir(), "atlas-source-test-"));
	try {
		const path = join(dir, "source.csv");
		const content = "value\n1\n";
		await writeFile(path, content);
		const finish = await trackDuckdbSource(path);
		const artifact = await finish();
		assert.equal(artifact.bytes, Buffer.byteLength(content));
		assert.equal(
			artifact.sha256,
			createHash("sha256").update(content).digest("hex"),
		);
		const finishChanged = await trackDuckdbSource(path);
		await writeFile(path, "value\n123\n");
		await assert.rejects(finishChanged(), /Source changed while reading/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
