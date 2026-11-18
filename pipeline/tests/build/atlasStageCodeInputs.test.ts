import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { stageCodeFiles } from "../../build-data-code.mjs";
import { buildDataStages } from "../../build-data-graph.mjs";

const root = resolve(import.meta.dirname, "../../..");

test("assemble-atlas is keyed on the worker it starts by path, and its worker count is not a key", () => {
	const stage = buildDataStages.find(
		({ name }) => name === "assemble-atlas",
	)!;
	const files = execFileSync(
		"git",
		["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
		{ cwd: root, encoding: "utf8", maxBuffer: 1 << 28 },
	)
		.split("\0")
		.filter(Boolean);
	const keyed = stageCodeFiles(root, stage, files);
	// Found by import: the pool the worker and the writer share.
	expect(keyed).toContain("pipeline/src/lib/syncWorkerPool.ts");
	// Not found by import, since a worker is started by its path.
	expect(keyed).toContain("pipeline/src/storage/areaLocationWorker.ts");
	// The count is an environment setting, so it is not among the command's
	// arguments, which the key includes.
	expect(stage.args.join(" ")).not.toMatch(/worker/i);
});
