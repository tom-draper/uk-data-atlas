import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { precompileFingerprints } from "@/scripts/precompile-fingerprint.mjs";
import { CATALOGUE_DATASET_DEFINITIONS } from "@/lib/data/catalog";

let root: string;

const write = async (path: string, contents: string) => {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await writeFile(join(root, path), contents);
};

const definition = (type: string, imports = "") =>
	`${imports}\nexport const definition = {\n\ttype: "${type}",\n};\n`;

/** Every path the fingerprint reads, with two datasets that each own a loader. */
const createRepository = async () => {
	await write("data-release.json", "{}");
	await write("package.json", JSON.stringify({ dependencies: {} }));
	await write("pnpm-lock.yaml", "lock");
	await write(
		"tsconfig.json",
		JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } }),
	);
	for (const file of [
		"scripts/compile-boundaries.mts",
		"scripts/dataset-discovery.ts",
		"scripts/dataset-region-chunks.mts",
		"scripts/generate-dataset-registry.ts",
		"scripts/generate-sources-readme.mts",
		"scripts/precompile-data.mts",
		"scripts/precompile-fingerprint.mjs",
		"scripts/precompile-selection.ts",
		"packages/geography/package.json",
		"packages/geography/src/index.ts",
		"public/data/datasets/boundary-mappings.json",
		"public/data/datasets/parish-lad-mappings.json",
	])
		await write(file, `// ${file}`);
	await write(
		"scripts/precompile/compileDataset.mts",
		'import { helper } from "../../lib/helpers/shared";\nimport { validate } from "../../lib/data/catalog";\n',
	);
	await write("scripts/precompile/cache.mts", "// cache");
	await write("lib/helpers/shared.ts", "export const helper = 1;");
	await write(
		"lib/data/catalog/index.ts",
		'export { validate } from "./ingestion";\nexport { ALL } from "./registry";\n',
	);
	await write("lib/data/catalog/ingestion.ts", "export const validate = 1;");
	await write(
		"lib/data/catalog/registry.ts",
		'import { alpha } from "./definitions/alpha";\nimport { beta } from "./definitions/beta";\n',
	);
	await write("lib/data/catalog/generated.ts", "// generated");
	await write(
		"lib/data/catalog/definitions/index.ts",
		'export * from "./alpha";\nexport * from "./beta";\n',
	);
	await write(
		"lib/data/catalog/definitions/alpha.ts",
		definition("alpha", 'import { load } from "../../alpha/loader";'),
	);
	await write(
		"lib/data/catalog/definitions/beta.ts",
		definition("beta", 'import { load } from "@/lib/data/beta/loader";'),
	);
	await write("lib/data/alpha/loader.ts", "export const load = 'alpha';");
	await write("lib/data/beta/loader.ts", "export const load = 'beta';");
};

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "fingerprint-"));
	await createRepository();
});

afterEach(() => rm(root, { recursive: true, force: true }));

describe("precompile fingerprints", () => {
	it("fingerprints each dataset by its type", async () => {
		const { datasets } = await precompileFingerprints(root);

		expect(Object.keys(datasets)).toEqual(["alpha", "beta"]);
		expect(datasets.alpha).not.toEqual(datasets.beta);
	});

	it("is stable while nothing changes", async () => {
		expect(await precompileFingerprints(root)).toEqual(
			await precompileFingerprints(root),
		);
	});

	it("changes only a dataset's own fingerprint when its loader changes", async () => {
		const before = await precompileFingerprints(root);
		await write("lib/data/alpha/loader.ts", "export const load = 'new';");
		const after = await precompileFingerprints(root);

		expect(after.datasets.alpha).not.toEqual(before.datasets.alpha);
		expect(after.datasets.beta).toEqual(before.datasets.beta);
		expect(after.pipeline).toEqual(before.pipeline);
	});

	it("changes only a dataset's own fingerprint when its definition changes", async () => {
		const before = await precompileFingerprints(root);
		await write(
			"lib/data/catalog/definitions/beta.ts",
			definition(
				"beta",
				'import { load } from "@/lib/data/beta/loader";',
			) + "// edited\n",
		);
		const after = await precompileFingerprints(root);

		expect(after.datasets.beta).not.toEqual(before.datasets.beta);
		expect(after.datasets.alpha).toEqual(before.datasets.alpha);
		expect(after.pipeline).toEqual(before.pipeline);
	});

	it("changes every dataset when code they all use changes", async () => {
		const before = await precompileFingerprints(root);
		await write("lib/helpers/shared.ts", "export const helper = 2;");
		const after = await precompileFingerprints(root);

		expect(after.datasets.alpha).not.toEqual(before.datasets.alpha);
		expect(after.datasets.beta).not.toEqual(before.datasets.beta);
	});

	it("changes every dataset when the data release changes", async () => {
		const before = await precompileFingerprints(root);
		await write("data-release.json", '{"version":2}');
		const after = await precompileFingerprints(root);

		expect(after.datasets.alpha).not.toEqual(before.datasets.alpha);
		expect(after.datasets.beta).not.toEqual(before.datasets.beta);
		expect(after.pipeline).not.toEqual(before.pipeline);
	});

	it("leaves the others alone when a dataset is added", async () => {
		const before = await precompileFingerprints(root);
		await write(
			"lib/data/catalog/definitions/gamma.ts",
			definition("gamma"),
		);
		await write(
			"lib/data/catalog/registry.ts",
			'import { gamma } from "./definitions/gamma";\n',
		);
		await write("lib/data/catalog/generated.ts", "// regenerated");
		const after = await precompileFingerprints(root);

		expect(Object.keys(after.datasets)).toEqual(["alpha", "beta", "gamma"]);
		expect(after.datasets.alpha).toEqual(before.datasets.alpha);
		expect(after.datasets.beta).toEqual(before.datasets.beta);
		expect(after.pipeline).toEqual(before.pipeline);
	});

	it("changes the pipeline, not the datasets, when pipeline code changes", async () => {
		const before = await precompileFingerprints(root);
		await write("scripts/precompile/cache.mts", "// edited");
		const after = await precompileFingerprints(root);

		expect(after.pipeline).not.toEqual(before.pipeline);
		expect(after.datasets).toEqual(before.datasets);
	});

	it("refuses two definitions that declare the same type", async () => {
		await write(
			"lib/data/catalog/definitions/gamma.ts",
			definition("alpha"),
		);

		await expect(precompileFingerprints(root)).rejects.toThrow(
			"Two dataset definitions declare the type alpha",
		);
	});
});

describe("the catalogue's fingerprints", () => {
	it("cover exactly the registered datasets", async () => {
		const { datasets } = await precompileFingerprints(process.cwd());

		expect(Object.keys(datasets).sort()).toEqual(
			CATALOGUE_DATASET_DEFINITIONS.map(({ type }) => type).sort(),
		);
	});
});
