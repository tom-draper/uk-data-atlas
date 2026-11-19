import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { onTestFinished, test } from "vitest";
import { createStageCache, stageScope } from "@/pipeline/build-data-cache.mjs";

type Stage = {
	name: string;
	args: string[];
	writes?: string[];
	outputs?: string[];
	requiredOutputs?: string[];
};

const alpha: Stage = { name: "alpha", args: [], writes: ["data/build/a"] };
const beta: Stage = {
	name: "beta",
	args: [],
	writes: ["data/build/b.json"],
	outputs: ["data/build/b"],
};

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "atlas-build-scope-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const write = (path: string, content: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	};
	const cache = () =>
		createStageCache({
			root,
			stateFile: join(root, ".cache/stages.json"),
			codeFiles: () => [],
			environment: {},
		});
	return { root, write, cache };
}

const outputsOf = (root: string, name: string) =>
	Object.keys(
		JSON.parse(readFileSync(join(root, ".cache/stages.json"), "utf8"))
			.stages[name].outputs,
	);

test("a stage's scope joins its writes, outputs and required outputs", () => {
	assert.deepEqual(
		stageScope({
			writes: ["x", "y"],
			outputs: ["y", "z"],
			requiredOutputs: ["x", "w"],
		}),
		["x", "y", "z", "w"],
	);
	assert.equal(stageScope({}), null);
});

test("stages with separate scopes can run at once and record only their own files", () => {
	const { root, write, cache } = fixture();
	const concurrent = cache();
	concurrent.begin(alpha);
	concurrent.begin(beta);
	write("data/build/b.json", "{}");
	write("data/build/b/one.json", "1");
	write("data/build/a/one.json", "a");
	const betaDigest = concurrent.record(beta, []);
	const alphaDigest = concurrent.record(alpha, []);
	assert.deepEqual(outputsOf(root, "alpha"), ["data/build/a/one.json"]);
	assert.deepEqual(outputsOf(root, "beta"), [
		"data/build/b.json",
		"data/build/b/one.json",
	]);

	// The same stages run one after another give the same digests.
	const sequential = fixture();
	const cold = sequential.cache();
	cold.begin(alpha);
	sequential.write("data/build/a/one.json", "a");
	assert.equal(cold.record(alpha, []), alphaDigest);
	cold.begin(beta);
	sequential.write("data/build/b.json", "{}");
	sequential.write("data/build/b/one.json", "1");
	assert.equal(cold.record(beta, []), betaDigest);
});

test("a recorded stage is skipped again from its own files alone", () => {
	const { write, cache } = fixture();
	const first = cache();
	first.begin(alpha);
	write("data/build/a/one.json", "a");
	const digest = first.record(alpha, []);
	assert.equal(cache().lookup(alpha, []), digest);
	// Another stage's file in the same tree does not disturb it.
	write("data/build/unrelated.json", "u");
	assert.equal(cache().lookup(alpha, []), digest);
	write("data/build/a/one.json", "edited, longer");
	assert.equal(cache().lookup(alpha, []), null);
});

test("a scoped stage keeps its earlier files outside the scope", () => {
	const { root, write, cache } = fixture();
	const wide: Stage = {
		name: "wide",
		args: [],
		writes: ["data/build/w1.json", "data/build/w2.json"],
	};
	const narrow = { ...wide, writes: ["data/build/w1.json"] };
	const first = cache();
	first.begin(wide);
	write("data/build/w1.json", "1");
	write("data/build/w2.json", "2");
	first.record(wide, []);
	const second = cache();
	second.begin(narrow);
	write("data/build/w1.json", "11");
	second.record(narrow, []);
	assert.deepEqual(outputsOf(root, "wide"), [
		"data/build/w1.json",
		"data/build/w2.json",
	]);
});

test("a stage without a scope tracks the whole tree after scoped stages ran", () => {
	const { root, write, cache } = fixture();
	const running = cache();
	running.begin(alpha);
	write("data/build/a/one.json", "a");
	running.record(alpha, []);
	const exclusive: Stage = { name: "exclusive", args: [] };
	running.begin(exclusive);
	write("data/build/other.json", "o");
	running.record(exclusive, []);
	assert.deepEqual(outputsOf(root, "exclusive"), ["data/build/other.json"]);
	assert.deepEqual(outputsOf(root, "alpha"), ["data/build/a/one.json"]);
});

test("a folder listed as a required output counts as present while it holds files", () => {
	const { root, write, cache } = fixture();
	const catalog: Stage = {
		name: "catalog",
		args: [],
		writes: ["data/build/observations"],
		requiredOutputs: ["data/build/observations"],
	};
	const first = cache();
	first.begin(catalog);
	write("data/build/observations/one.json", "1");
	const digest = first.record(catalog, []);
	assert.equal(cache().lookup(catalog, []), digest);
	// A removed file reruns the stage, and so does a removed folder.
	rmSync(join(root, "data/build/observations/one.json"));
	assert.equal(cache().lookup(catalog, []), null);
	write("data/build/observations/one.json", "1");
	assert.equal(cache().lookup(catalog, []), null);
	rmSync(join(root, "data/build/observations"), { recursive: true });
	assert.equal(cache().lookup(catalog, []), null);
});

test("adoption takes the files in a required folder, and refuses an empty one", () => {
	const { root, write, cache } = fixture();
	const catalog: Stage = {
		name: "catalog",
		args: [],
		requiredOutputs: ["data/build/observations"],
	};
	mkdirSync(join(root, "data/build/observations"), { recursive: true });
	assert.throws(
		() => cache().adopt(catalog, []),
		/missing output data\/build\/observations/,
	);
	write("data/build/observations/one.json", "1");
	const adopted = cache().adopt(catalog, []);
	assert.deepEqual(adopted.files, ["data/build/observations/one.json"]);
});

test("a stage reports files it changed outside its scope, audited or not", () => {
	const { write, cache } = fixture();
	const current = cache();
	current.begin(alpha);
	write("data/build/a/one.json", "inside");
	write("data/build/stray.json", "outside");
	write("public/data/other/two.json", "outside too");
	assert.deepEqual(current.undeclaredChanges(alpha), [
		"data/build/stray.json",
		"public/data/other/two.json",
	]);
	current.record(alpha, []);
	// Only what changed counts: the strays are there already and left alone.
	current.begin(beta);
	write("data/build/b/two.json", "inside");
	assert.deepEqual(current.undeclaredChanges(beta), []);
	current.record(beta, []);
	current.begin(beta);
	write("data/build/stray.json", "changed again");
	assert.deepEqual(current.undeclaredChanges(beta), [
		"data/build/stray.json",
	]);
	current.record(beta, []);
	// A stage with no scope has no paths to be outside of.
	const unscoped: Stage = { name: "unscoped", args: [] };
	current.begin(unscoped, { audit: true });
	assert.deepEqual(current.undeclaredChanges(unscoped), []);
});

test("removing another stage's file is a write outside the scope", () => {
	const { root, write, cache } = fixture();
	const current = cache();
	write("data/build/b/kept.json", "b");
	current.begin(alpha);
	write("data/build/a/one.json", "inside");
	rmSync(join(root, "data/build/b/kept.json"));
	assert.deepEqual(current.undeclaredChanges(alpha), [
		"data/build/b/kept.json",
	]);
});

test("a file changed inside the scope of a stage running at the same time is not blamed on the other", () => {
	const { write, cache } = fixture();
	const current = cache();
	current.begin(alpha);
	current.begin(beta);
	write("data/build/a/one.json", "alpha's");
	write("data/build/b/one.json", "beta's");
	// Either may have written the other's file, and the scopes cannot say which.
	assert.deepEqual(current.undeclaredChanges(alpha), []);
	assert.deepEqual(current.undeclaredChanges(beta), []);
	current.record(alpha, []);
	current.record(beta, []);
	// Once they have ended, the same write by one of them is blamed on it.
	current.begin(alpha);
	write("data/build/b/one.json", "alpha, alone");
	assert.deepEqual(current.undeclaredChanges(alpha), [
		"data/build/b/one.json",
	]);
});

test("the temporary file a concurrent stage renames into place is not blamed on another", () => {
	const { root, write, cache } = fixture();
	const current = cache();
	// beta is part way through writing its database beside it when alpha begins.
	write("data/build/b.json.1234-abcd.tmp", "half");
	write("data/build/b.json-journal", "j");
	write("data/build/unrelated.tmp", "someone else's");
	current.begin(alpha);
	current.begin(beta);
	write("data/build/b.json", "whole");
	rmSync(join(root, "data/build/b.json.1234-abcd.tmp"));
	rmSync(join(root, "data/build/b.json-journal"));
	rmSync(join(root, "data/build/unrelated.tmp"));
	write("data/build/a/one.json", "alpha's");
	// What beta renamed away is beta's, but a file named like none of them is not.
	assert.deepEqual(current.undeclaredChanges(alpha), [
		"data/build/unrelated.tmp",
	]);
	// A stage's own temporary file is its own.
	assert.deepEqual(current.undeclaredChanges(beta), [
		"data/build/unrelated.tmp",
	]);
});

test("a stage's database temporary file and journal are its own when no id follows the name", () => {
	const { root, write, cache } = fixture();
	const current = cache();
	const gamma: Stage = {
		name: "gamma",
		args: [],
		writes: ["data/build/g.sqlite"],
	};
	// A run that stopped part way left these beside the database.
	write("data/build/g.sqlite.tmp", "half");
	write("data/build/g.sqlite-journal", "j");
	write("data/build/other.tmp", "someone else's");
	current.begin(gamma);
	write("data/build/g.sqlite", "whole");
	rmSync(join(root, "data/build/g.sqlite.tmp"));
	rmSync(join(root, "data/build/g.sqlite-journal"));
	rmSync(join(root, "data/build/other.tmp"));
	assert.deepEqual(current.undeclaredChanges(gamma), [
		"data/build/other.tmp",
	]);
});

test("a stage that ended before another began shares nothing with it", () => {
	const { write, cache } = fixture();
	const current = cache();
	current.begin(alpha);
	write("data/build/a/one.json", "a");
	assert.deepEqual(current.undeclaredChanges(alpha), []);
	current.record(alpha, []);
	current.begin(beta);
	write("data/build/a/one.json", "beta wrote alpha's file");
	assert.deepEqual(current.undeclaredChanges(beta), [
		"data/build/a/one.json",
	]);
});

test("an audited stage that changes a raw source file is reported", () => {
	const { write, cache } = fixture();
	write("data/source/input.csv", "a\n");
	const current = cache();
	current.begin(alpha, { audit: true });
	write("data/build/a/one.json", "inside");
	write("data/source/input.csv", "changed by a build stage");
	assert.deepEqual(current.undeclaredChanges(alpha), [
		"data/source/input.csv",
	]);
});

test("a stage with a declared scope does not discard other stages' cached keys", () => {
	const { root, write } = fixture();
	let codeReads = 0;
	const current = createStageCache({
		root,
		stateFile: join(root, ".cache/stages.json"),
		codeFiles: () => {
			codeReads += 1;
			return [];
		},
		environment: {},
	});
	const quiet: Stage = { name: "quiet", args: [], writes: ["data/build/q"] };
	const registry: Stage = { name: "registry", args: [] };
	current.begin(alpha);
	write("data/build/a/one.json", "a");
	current.record(alpha, []);
	current.lookup(alpha, []);
	const reads = codeReads;
	// A non-cacheable stage with a scope leaves the code keys alone.
	current.begin(quiet);
	current.record(quiet, [], { cacheable: false });
	current.lookup(alpha, []);
	assert.equal(codeReads, reads);
	// One without a scope may have rewritten code or sources, so they reset.
	current.begin(registry);
	current.record(registry, [], { cacheable: false });
	current.lookup(alpha, []);
	assert.equal(codeReads, reads + 1);
});

test("a stage tracked across the whole tree cannot begin beside another", () => {
	const { cache } = fixture();
	const current = cache();
	current.begin(alpha);
	// Passing a bare name loses the stage's scope, so it needs the tree alone.
	assert.throws(
		() => current.begin("beta"),
		/Pass the stage, not its name, to begin\(\)/,
	);
	assert.throws(
		() => current.begin({ name: "unscoped", args: [] }),
		/without a declared scope/,
	);
	// Once the running stage is done, even if it failed, it can.
	current.recordTiming("alpha", {
		commandMs: 1,
		totalMs: 1,
		finishedAt: "now",
		failed: true,
	});
	current.begin("beta");
	assert.throws(() => current.begin(alpha), /declared scope/);
});
