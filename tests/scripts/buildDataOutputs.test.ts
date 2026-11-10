import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	appendFileSync,
	linkSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { onTestFinished, test } from "vitest";
import { createStageCache } from "@/pipeline/build-data-cache.mjs";
import { runBuild } from "@/pipeline/build-data.mjs";
import {
	OUTPUT_MANIFEST_ENV,
	recordOutputHash,
	writeFileHashedSync,
} from "../../pipeline/src/storage/outputManifest";
import { sha256Hex } from "../../pipeline/src/lib/hash";

type Stage = {
	name: string;
	dependencies?: string[];
	args: string[];
	writes?: string[];
};

const alpha: Stage = { name: "alpha", args: [], writes: ["data/build/a"] };
const beta: Stage = { name: "beta", args: [], writes: ["public/data/b"] };

const digestOf = (content: string) =>
	createHash("sha256").update(content).digest("hex");

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "atlas-build-outputs-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const write = (path: string, content: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	};
	const hashed: string[] = [];
	const cache = () =>
		createStageCache({
			root,
			stateFile: join(root, ".cache/stages.json"),
			codeFiles: () => [],
			environment: {},
			hashFile: (path: string) => {
				hashed.push(path.slice(root.length + 1));
				return digestOf(readFileSync(path, "utf8"));
			},
		});
	return { root, write, cache, hashed };
}

const recorded = (root: string, name: string) =>
	JSON.parse(readFileSync(join(root, ".cache/stages.json"), "utf8")).stages[
		name
	].outputs as Record<string, { sha256: string; ino: number }>;

test("a stage's outputs are stat-checked, and only changed files are hashed", () => {
	const { root, write, cache, hashed } = fixture();
	const first = cache();
	first.begin(alpha);
	write("data/build/a/one.bin", "one");
	write("data/build/a/two.bin", "two");
	write("data/build/untouched/other.bin", "outside the scope");
	first.record(alpha, []);
	// Only files in the stage's scope are read, never the rest of the tree.
	assert.deepEqual(hashed.sort(), [
		"data/build/a/one.bin",
		"data/build/a/two.bin",
	]);
	hashed.length = 0;
	const second = cache();
	second.begin(alpha);
	write("data/build/a/two.bin", "changed");
	second.record(alpha, []);
	assert.deepEqual(hashed, ["data/build/a/two.bin"]);
	assert.equal(
		recorded(root, "alpha")["data/build/a/one.bin"].sha256,
		digestOf("one"),
	);
});

test("a file replaced by another with the same size and mtime is hashed again", () => {
	const { write, cache, hashed, root } = fixture();
	write("data/build/a/one.bin", "aaa");
	const first = cache();
	first.begin(alpha);
	write("data/build/a/one.bin", "aaa");
	first.record(alpha, []);
	hashed.length = 0;
	const stamp = statSync(join(root, "data/build/a/one.bin"));
	const second = cache();
	second.begin(alpha);
	write("data/build/a/replacement.bin", "bbb");
	utimesSync(
		join(root, "data/build/a/replacement.bin"),
		stamp.atime,
		stamp.mtime,
	);
	renameSync(
		join(root, "data/build/a/replacement.bin"),
		join(root, "data/build/a/one.bin"),
	);
	second.record(alpha, []);
	assert.deepEqual(hashed, ["data/build/a/one.bin"]);
});

test("a link to a file already hashed shares its hash", () => {
	const { root, write, cache, hashed } = fixture();
	const stages = cache();
	stages.begin(alpha);
	write("data/build/a/tiles.pmtiles", "tiles");
	stages.record(alpha, []);
	hashed.length = 0;
	stages.begin(beta);
	mkdirSync(join(root, "public/data/b"), { recursive: true });
	for (const name of ["hashed.pmtiles", "alias.pmtiles"])
		linkSync(
			join(root, "data/build/a/tiles.pmtiles"),
			join(root, "public/data/b", name),
		);
	write("public/data/b/properties.json", "{}");
	stages.record(beta, []);
	// Both links share the inode alpha's file was hashed under.
	assert.deepEqual(hashed, ["public/data/b/properties.json"]);
	assert.equal(
		recorded(root, "beta")["public/data/b/alias.pmtiles"].sha256,
		digestOf("tiles"),
	);
});

test("hashes a stage recorded while writing are trusted without reading the file", () => {
	const { root, write, cache, hashed } = fixture();
	const stages = cache();
	stages.begin(alpha);
	const manifest = stages.manifestPath("alpha");
	write("data/build/a/streamed.bin", "streamed");
	recordOutputHash(
		join(root, "data/build/a/streamed.bin"),
		sha256Hex("streamed"),
		manifest,
	);
	write("data/build/a/plain.bin", "plain");
	const digest = stages.record(alpha, []);
	assert.deepEqual(hashed, ["data/build/a/plain.bin"]);
	// The digest is what hashing every file would have given.
	const reference = fixture();
	const other = reference.cache();
	other.begin(alpha);
	reference.write("data/build/a/streamed.bin", "streamed");
	reference.write("data/build/a/plain.bin", "plain");
	assert.equal(digest, other.record(alpha, []));
	assert.throws(() => statSync(manifest));
});

test("a recorded hash is ignored once the file has changed since", () => {
	const { root, write, cache, hashed } = fixture();
	const stages = cache();
	stages.begin(alpha);
	const manifest = stages.manifestPath("alpha");
	write("data/build/a/file.bin", "first");
	recordOutputHash(
		join(root, "data/build/a/file.bin"),
		sha256Hex("first"),
		manifest,
	);
	write("data/build/a/file.bin", "second, and longer");
	stages.record(alpha, []);
	assert.deepEqual(hashed, ["data/build/a/file.bin"]);
	assert.equal(
		recorded(root, "alpha")["data/build/a/file.bin"].sha256,
		digestOf("second, and longer"),
	);
});

test("a manifest tolerates damage and paths outside the repository", () => {
	const { root, write, cache, hashed } = fixture();
	const stages = cache();
	stages.begin(alpha);
	const manifest = stages.manifestPath("alpha");
	write("data/build/a/file.bin", "file");
	recordOutputHash(
		join(root, "data/build/a/file.bin"),
		sha256Hex("file"),
		manifest,
	);
	appendFileSync(manifest, '{"path": "/etc/passwd", "sha256": "0"}\n');
	appendFileSync(
		manifest,
		`${JSON.stringify({ path: "../escape", size: 1, mtimeMs: 1, sha256: "a".repeat(64) })}\n`,
	);
	appendFileSync(manifest, '{"path": "data/build/a/trunc');
	stages.record(alpha, []);
	assert.deepEqual(hashed, []);
});

test("the stage helpers write the file and only note a hash when the build asks", () => {
	const { root } = fixture();
	const path = join(root, "out/file.bin");
	mkdirSync(dirname(path), { recursive: true });
	assert.equal(process.env[OUTPUT_MANIFEST_ENV], undefined);
	writeFileHashedSync(path, "content");
	assert.equal(readFileSync(path, "utf8"), "content");
	const manifest = join(root, "manifest/alpha.jsonl");
	writeFileHashedSync(path, "content", manifest);
	const [line] = readFileSync(manifest, "utf8").trim().split("\n");
	assert.deepEqual(
		{ path: JSON.parse(line).path, sha256: JSON.parse(line).sha256 },
		{ path, sha256: sha256Hex("content") },
	);
});

const runVerified = async (
	root: string,
	stages: Stage[],
	execute: (stage: Stage, options: { outputManifest?: string }) => number,
	argv: string[] = ["--verify-outputs", "--no-cache"],
) => {
	const log: string[] = [];
	const errors: string[] = [];
	const status = await runBuild({
		argv,
		stages: stages.map((stage) => ({ dependencies: [], ...stage })),
		log: (line: string) => log.push(line),
		logError: (message: string) => errors.push(message),
		execute,
		createCache: () =>
			createStageCache({
				root,
				stateFile: join(root, ".cache/stages.json"),
				codeFiles: () => [],
				environment: {},
			}),
	});
	return { status, log, errors };
};

test("verify mode catches a write outside the declared outputs", async () => {
	const { root, write } = fixture();
	const stages: Stage[] = [alpha];
	const clean = await runVerified(root, stages, () => {
		write("data/build/a/file.json", "{}");
		return 0;
	});
	assert.equal(clean.status, 0);
	const stray = await runVerified(root, stages, () => {
		write("data/build/a/file.json", "{ }");
		write("data/build/stray.json", "{}");
		return 0;
	});
	assert.equal(stray.status, 1);
	assert.ok(stray.log.includes("  data/build/stray.json"));
	assert.ok(stray.errors.includes("Output verification failed."));
});

test("verify mode catches a stage that recorded a hash its file does not have", async () => {
	const { root, write } = fixture();
	const stages: Stage[] = [alpha];
	const lying = (
		stage: Stage,
		{ outputManifest }: { outputManifest?: string },
	) => {
		assert.ok(outputManifest);
		write("data/build/a/file.bin", "real");
		recordOutputHash(
			join(root, "data/build/a/file.bin"),
			sha256Hex("not the real bytes"),
			outputManifest,
		);
		return stage.name === "alpha" ? 0 : 1;
	};
	const verified = await runVerified(root, stages, lying);
	assert.equal(verified.status, 1);
	assert.ok(
		verified.log.includes(
			"alpha: recorded a hash that does not match 1 file",
		),
	);
	assert.ok(verified.log.includes("  data/build/a/file.bin"));
	// The record holds what the bytes hash to, so the lie never reaches a digest.
	assert.equal(
		recorded(root, "alpha")["data/build/a/file.bin"].sha256,
		digestOf("real"),
	);
	// Without verification the cache takes the stage at its word.
	const trusting = await runVerified(root, stages, lying, ["--no-cache"]);
	assert.equal(trusting.status, 0);
	assert.equal(
		recorded(root, "alpha")["data/build/a/file.bin"].sha256,
		sha256Hex("not the real bytes"),
	);
});

test("--check-writes and DATA_BUILD_VERIFY_OUTPUTS verify as well", async () => {
	const { root, write } = fixture();
	const stray = () => {
		write("data/build/stray.json", "{}");
		return 0;
	};
	assert.equal(
		(
			await runVerified(root, [alpha], stray, [
				"--check-writes",
				"--no-cache",
			])
		).status,
		1,
	);
	process.env.DATA_BUILD_VERIFY_OUTPUTS = "1";
	onTestFinished(() => {
		delete process.env.DATA_BUILD_VERIFY_OUTPUTS;
	});
	assert.equal(
		(await runVerified(root, [alpha], stray, ["--no-cache"])).status,
		1,
	);
});
