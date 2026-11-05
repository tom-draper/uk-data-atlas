import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { onTestFinished, test } from "vitest";
import { createStageCache } from "@/pipeline/build-data-cache.mjs";
import { runBuild } from "@/pipeline/build-data.mjs";
import { sourcesMatchRelease } from "@/scripts/data-release.mjs";

const tag = "data-2026-10-30";

function release(overrides: { tag?: string; stamps?: boolean } = {}) {
	const root = mkdtempSync(join(tmpdir(), "atlas-sources-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const write = (path: string, content: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	};
	write(
		"data-release.json",
		JSON.stringify({
			version: 2,
			tag: overrides.tag ?? tag,
			commit: "a".repeat(40),
			repository: "owner/repo",
			assets: [],
		}),
	);
	write("data/source/a.csv", "a,b\n");
	const stamp = (path: string) => {
		const stats = statSync(join(root, "data/source", path));
		return {
			bytes: stats.size,
			modifiedAt: stats.mtimeMs,
			changedAt: stats.ctimeMs,
		};
	};
	const marker = () =>
		write(
			"data/source/.source-release.json",
			JSON.stringify({
				version: 3,
				tag,
				repository: "owner/repo",
				files: { "a.csv": "hash" },
				fileStamps: { "a.csv": stamp("a.csv") },
			}),
		);
	if (overrides.stamps !== false) marker();
	return { root, write, marker };
}

test("the sources match when the marker names the pinned release and the stamps hold", async () => {
	const { root } = release();
	assert.equal(await sourcesMatchRelease(root), true);
});

test("the sources do not match without a marker, for another release or after an edit", async () => {
	const missing = release({ stamps: false });
	assert.equal(await sourcesMatchRelease(missing.root), false);

	const other = release({ tag: "data-2026-11-01" });
	assert.equal(await sourcesMatchRelease(other.root), false);

	const edited = release();
	edited.write("data/source/a.csv", "a,b,c\n");
	assert.equal(await sourcesMatchRelease(edited.root), false);

	const removed = release();
	rmSync(join(removed.root, "data/source/a.csv"));
	assert.equal(await sourcesMatchRelease(removed.root), false);

	const unpinned = release();
	rmSync(join(unpinned.root, "data-release.json"));
	assert.equal(await sourcesMatchRelease(unpinned.root), false);
});

test("a corrupt marker or config means the download decides", async () => {
	const corrupt = release();
	corrupt.write("data/source/.source-release.json", "{");
	assert.equal(await sourcesMatchRelease(corrupt.root), false);

	const unsupported = release();
	unsupported.write("data-release.json", JSON.stringify({ version: 1 }));
	assert.equal(await sourcesMatchRelease(unsupported.root), false);
});

type Stage = {
	name: string;
	dependencies: string[];
	args: string[];
	cacheable?: boolean;
	isCurrent?: () => boolean | Promise<boolean>;
	outputs?: string[];
};

function sourcesBuild() {
	const root = mkdtempSync(join(tmpdir(), "atlas-sources-build-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	let current = false;
	const stages: Stage[] = [
		{
			name: "sources",
			dependencies: [],
			args: ["download"],
			cacheable: false,
			isCurrent: () => current,
		},
		{ name: "compile", dependencies: ["sources"], args: ["compile"] },
	];
	const ran: string[] = [];
	const build = async (argv: string[] = []) => {
		const log: string[] = [];
		ran.length = 0;
		const status = await runBuild({
			argv,
			stages,
			log: (line: string) => log.push(line),
			logError: () => {},
			createCache: () =>
				createStageCache({
					root,
					stateFile: join(root, ".cache/stages.json"),
					codeFiles: () => [],
					environment: {},
				}),
			execute: (stage: Stage) => {
				ran.push(stage.name);
				if (stage.name === "compile") {
					mkdirSync(join(root, "data/build"), { recursive: true });
					writeFileSync(join(root, "data/build/compiled.json"), "{}");
				}
				return 0;
			},
		});
		assert.equal(status, 0);
		return { ran: [...ran], log };
	};
	return {
		build,
		setCurrent: (value: boolean) => {
			current = value;
		},
	};
}

test("sources skips its download once the release is current, and compile stays cached", async () => {
	const { build, setCurrent } = sourcesBuild();
	assert.deepEqual((await build()).ran, ["sources", "compile"]);
	// Without a current release the download still runs, and nothing else.
	assert.deepEqual((await build()).ran, ["sources"]);
	setCurrent(true);
	const skipped = await build();
	assert.deepEqual(skipped.ran, []);
	assert.ok(
		skipped.log.some((line) => line === "sources: up to date, skipped"),
	);
	assert.ok(skipped.log.some((line) => line.includes("0 to run")));
});

test("a plan reports the download it would skip, and --no-cache and --from still run it", async () => {
	const { build, setCurrent } = sourcesBuild();
	await build();
	setCurrent(true);
	const plan = await build(["--plan"]);
	assert.ok(
		plan.log.some((line) => line === "sources: up to date, would skip"),
	);
	assert.deepEqual(plan.ran, []);
	assert.deepEqual((await build(["--no-cache"])).ran, ["sources", "compile"]);
	assert.deepEqual((await build(["--from", "sources"])).ran, [
		"sources",
		"compile",
	]);
});
