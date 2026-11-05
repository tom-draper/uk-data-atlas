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
