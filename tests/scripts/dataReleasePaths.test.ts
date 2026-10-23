import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { filesUnder, replaceSources } from "@/scripts/data-release.mjs";

test("restoring raw sources preserves generated data and excludes it from releases", async () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-release-paths-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const data = join(root, "data");
	const staging = join(root, "incoming");
	const workspace = join(root, "workspace");
	for (const directory of [join(data, "build"), staging, workspace])
		mkdirSync(directory, { recursive: true });
	writeFileSync(join(data, "old.csv"), "old");
	writeFileSync(join(data, "build/atlas.sqlite"), "generated database");
	writeFileSync(join(staging, "new.csv"), "new");
	await replaceSources(staging, { data, workspace });
	expect(readFileSync(join(data, "build/atlas.sqlite"), "utf8")).toBe(
		"generated database",
	);
	expect(await filesUnder(data)).toEqual([{ path: "new.csv", bytes: 3 }]);
	expect(readFileSync(join(data, "new.csv"), "utf8")).toBe("new");
});
