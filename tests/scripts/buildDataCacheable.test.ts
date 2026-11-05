import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { onTestFinished, test } from "vitest";
import { createStageCache } from "@/pipeline/build-data-cache.mjs";
import { runBuild } from "@/pipeline/build-data.mjs";

type Stage = {
	name: string;
	dependencies: string[];
	args: string[];
	cacheable?: boolean;
	exclusive?: boolean;
	shared?: string[];
	outputs?: string[];
	requiredOutputs?: string[];
	writes?: string[];
};

/** A scratch repository, a stage list and a build that records what ran. */
function fixture(
	stages: Stage[],
	{
		codeFiles = (_stage: { name: string }) => [] as string[],
		files = {} as Record<string, string>,
	} = {},
) {
	const root = mkdtempSync(join(tmpdir(), "atlas-cacheable-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const write = (path: string, content: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	};
	for (const [path, content] of Object.entries(files)) write(path, content);
	const ran: string[] = [];
	// What each stage writes when it runs, by stage name.
	const effects: Record<string, (stage: Stage) => void> = {};
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
					codeFiles,
					environment: {},
				}),
			execute: (stage: Stage) => {
				ran.push(stage.name);
				effects[stage.name]?.(stage);
				return 0;
			},
		});
		assert.equal(status, 0);
		return { ran: [...ran], log };
	};
	return {
		root,
		write,
		build,
		effects,
		read: (path: string) => readFileSync(join(root, path), "utf8"),
	};
}

const generated = "packages/catalog/registry.ts";

// A registry rewrites a checked-in file, and a compiler reads it.
const registryStages: Stage[] = [
	{
		name: "download",
		dependencies: [],
		args: ["download"],
		cacheable: false,
	},
	{
		name: "registry",
		dependencies: ["download"],
		args: ["registry"],
		exclusive: true,
		requiredOutputs: [generated],
	},
	{
		name: "compile",
		dependencies: ["registry"],
		args: ["compile"],
		requiredOutputs: ["data/build/compiled.json"],
	},
];

function registryFixture() {
	const current = fixture(registryStages, {
		// The compiler imports the generated registry, and the registry reads
		// the definitions beside it.
		codeFiles: (stage: { name: string }) =>
			stage.name === "registry"
				? ["packages/catalog/definitions.ts"]
				: stage.name === "compile"
					? [generated]
					: [],
		files: { "packages/catalog/definitions.ts": "one\n" },
	});
	let version = "a";
	current.effects.registry = () =>
		current.write(generated, `registry ${version}\n`);
	current.effects.compile = () =>
		current.write("data/build/compiled.json", `${current.read(generated)}`);
	return {
		...current,
		setVersion: (value: string) => {
			version = value;
		},
	};
}

test("a registry that rewrites checked-in code skips when nothing changed", async () => {
	const { build } = registryFixture();
	assert.deepEqual((await build()).ran, ["download", "registry", "compile"]);
	assert.deepEqual((await build()).ran, ["download"]);
});

test("a registry reruns when its generated file is deleted or edited", async () => {
	const { build, root, write } = registryFixture();
	await build();
	unlinkSync(join(root, generated));
	assert.deepEqual((await build()).ran, ["download", "registry"]);
	// Identical bytes, so the compiler stays cached.
	assert.deepEqual((await build()).ran, ["download"]);
	write(generated, "edited by hand\n");
	assert.deepEqual((await build()).ran, ["download", "registry"]);
	assert.deepEqual((await build()).ran, ["download"]);
});

test("a registry reruns when a definition it reads changes", async () => {
	const { build, write, setVersion } = registryFixture();
	await build();
	write("packages/catalog/definitions.ts", "two\n");
	assert.deepEqual((await build()).ran, ["download", "registry"]);
	write("packages/catalog/definitions.ts", "three\n");
	setVersion("b");
	assert.deepEqual((await build()).ran, ["download", "registry", "compile"]);
	// The compiler's code key was taken after the registry wrote its file.
	assert.deepEqual((await build()).ran, ["download"]);
});

test("--no-cache and --from rerun a cached registry", async () => {
	const { build } = registryFixture();
	await build();
	assert.deepEqual((await build(["--no-cache"])).ran, [
		"download",
		"registry",
		"compile",
	]);
	assert.deepEqual((await build(["--from", "registry"])).ran, [
		"registry",
		"compile",
	]);
});

test("adopting a registry accepts its checked-in outputs", async () => {
	const { build, root, write } = registryFixture();
	write(generated, "registry a\n");
	write("data/build/compiled.json", "registry a\n");
	const adopted = await build(["--adopt"]);
	assert.deepEqual(adopted.ran, []);
	assert.ok(existsSync(join(root, ".cache/stages.json")));
	assert.deepEqual((await build()).ran, ["download"]);
});

const cachePath = "data/build/atlas-cache.sqlite";
const stampPath = (name: string) => `data/build/.stamps/${name}.json`;

// Several stages add to one shared file. Each leaves a stamp of what it owns,
// and the last one owns the file itself.
const sharedStages: Stage[] = [
	{
		name: "upstream",
		dependencies: [],
		args: ["upstream"],
		requiredOutputs: ["data/build/upstream.json"],
	},
	{
		name: "base",
		dependencies: ["upstream"],
		args: ["base"],
		requiredOutputs: [cachePath],
		writes: [stampPath("writer-a"), stampPath("writer-b")],
	},
	...["writer-a", "writer-b"].map((name): Stage => ({
		name,
		dependencies: ["base"],
		args: [name],
		shared: [cachePath],
		requiredOutputs: [stampPath(name)],
	})),
	{
		name: "final",
		dependencies: ["writer-a", "writer-b"],
		args: ["final"],
		requiredOutputs: [cachePath, stampPath("final")],
	},
	{
		name: "release",
		dependencies: ["writer-a"],
		args: ["release"],
		requiredOutputs: ["data/build/release.json"],
	},
];

function sharedFixture() {
	const current = fixture(sharedStages, {
		codeFiles: (stage: { name: string }) =>
			stage.name === "base"
				? ["base.ts"]
				: stage.name === "upstream"
					? ["upstream.ts"]
					: [],
		files: { "base.ts": "one\n", "upstream.ts": "u1" },
	});
	// What each writer's own tables hold; its stamp is a hash of just that.
	const tables: Record<string, string> = {
		"writer-a": "a1",
		"writer-b": "b1",
	};
	const cache = () => JSON.parse(current.read(cachePath));
	const save = (value: object) =>
		current.write(cachePath, JSON.stringify(value));
	current.effects.upstream = () =>
		current.write("data/build/upstream.json", current.read("upstream.ts"));
	current.effects.base = () => {
		save({ base: current.read("data/build/upstream.json") });
		// A new cache has none of what the writers added.
		for (const name of ["writer-a", "writer-b"])
			rmSync(join(current.root, stampPath(name)), { force: true });
	};
	for (const name of ["writer-a", "writer-b"])
		current.effects[name] = () => {
			save({ ...cache(), [name]: tables[name] });
			current.write(stampPath(name), `${name} ${tables[name]}\n`);
		};
	current.effects.final = () => {
		save({ ...cache(), final: true });
		current.write(stampPath("final"), "final\n");
	};
	current.effects.release = () =>
		current.write(
			"data/build/release.json",
			current.read(stampPath("writer-a")),
		);
	return {
		...current,
		cache,
		save,
		tables,
		setUpstream: (value: string) => current.write("upstream.ts", value),
	};
}

const everything = [
	"upstream",
	"base",
	"writer-a",
	"writer-b",
	"final",
	"release",
];

test("stages that add to a shared file skip when nothing changed", async () => {
	const { build, cache } = sharedFixture();
	assert.deepEqual((await build()).ran, everything);
	assert.deepEqual((await build()).ran, []);
	assert.deepEqual(cache(), {
		base: "u1",
		"writer-a": "a1",
		"writer-b": "b1",
		final: true,
	});
});

test("a writer reruns when its stamp is deleted, and the last stage follows the file it rewrote", async () => {
	const { build, root } = sharedFixture();
	await build();
	rmSync(join(root, stampPath("writer-b")));
	assert.deepEqual((await build()).ran, ["writer-b", "final"]);
	assert.deepEqual((await build()).ran, []);
});

test("a writer reruns when its stamp is edited, but its readers stay cached if its tables are the same", async () => {
	const { build, write } = sharedFixture();
	await build();
	write(stampPath("writer-a"), "tampered\n");
	// release reads writer-a, whose stamp comes back as it was.
	assert.deepEqual((await build()).ran, ["writer-a", "final"]);
	assert.deepEqual((await build()).ran, []);
});

test("a changed shared file reruns the stage that owns it, and only that one", async () => {
	const { build, write } = sharedFixture();
	await build();
	write(cachePath, "{}");
	assert.deepEqual((await build()).ran, ["final"]);
});

test("a deleted shared file is rebuilt, and every writer adds its tables again", async () => {
	const { build, root, cache } = sharedFixture();
	await build();
	unlinkSync(join(root, cachePath));
	const rebuilt = await build();
	assert.deepEqual(rebuilt.ran, ["base", "writer-a", "writer-b", "final"]);
	assert.equal(cache()["writer-a"], "a1");
	assert.equal(cache()["writer-b"], "b1");
	assert.deepEqual((await build()).ran, []);
});

test("a base rebuild with identical output clears the stamps, so writers rerun but their readers stay cached", async () => {
	const { build, write } = sharedFixture();
	await build();
	write("base.ts", "two\n");
	assert.deepEqual((await build()).ran, [
		"base",
		"writer-a",
		"writer-b",
		"final",
	]);
	assert.deepEqual((await build()).ran, []);
});

test("an upstream change rebuilds the shared file and reruns every writer after it", async () => {
	const { build, setUpstream } = sharedFixture();
	await build();
	setUpstream("u2");
	assert.deepEqual((await build()).ran, [
		"upstream",
		"base",
		"writer-a",
		"writer-b",
		"final",
	]);
});

test("a writer's digest follows its own tables, not the rest of the shared file", async () => {
	const { build, root, tables, cache } = sharedFixture();
	await build();
	// writer-b's tables change. The file changes, but release reads writer-a.
	tables["writer-b"] = "b2";
	rmSync(join(root, stampPath("writer-b")));
	assert.deepEqual((await build()).ran, ["writer-b", "final"]);
	assert.equal(cache()["writer-b"], "b2");
	// writer-a's tables change, and its reader reruns.
	tables["writer-a"] = "a2";
	rmSync(join(root, stampPath("writer-a")));
	assert.deepEqual((await build()).ran, ["writer-a", "final", "release"]);
	assert.deepEqual((await build()).ran, []);
});
