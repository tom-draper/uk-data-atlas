import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	datasetFingerprints,
	precompileFingerprints,
} from "@/pipeline/src/precompile/fingerprint.mjs";

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
		"pipeline/src/compile-boundaries.mts",
		"shared/reverseGridOffset.ts",
		"shared/buildTiming.ts",
		"pipeline/src/compile-boundary-tiles.mts",
		"scripts/dataset-discovery.ts",
		"scripts/dataset-region-chunks.mts",
		"scripts/generate-dataset-registry.ts",
		"pipeline/src/build-catalogue-registry.ts",
		"scripts/compile-website-data.mts",
		"pipeline/src/precompile/fingerprint.mjs",
		"packages/datasets/src/compileDataset.ts",
		"packages/geography/src/index.ts",
		"packages/map-tiles/package.json",
		"packages/map-tiles/src/compileTileset.ts",
		"data/build/atlas-assets/atlas-lookups/boundary-mappings.json.gz",
		"data/build/atlas-assets/atlas-lookups/parish-lad-mappings.json.gz",
	])
		await write(file, `// ${file}`);
	await write(
		"pipeline/src/precompile/compileDataset.mts",
		'import { helper } from "../../../lib/helpers/shared";\nimport { validate } from "../../../packages/datasets/src/data/catalog";\n',
	);
	await write("pipeline/src/precompile/cache.mts", "// cache");
	await write("scripts/precompile/roadSafety.mts", "// road safety");
	await write(
		"packages/geography/package.json",
		JSON.stringify({ exports: { ".": "./src/index.ts" } }),
	);
	await write("lib/helpers/shared.ts", "export const helper = 1;");
	await write(
		"packages/datasets/src/data/catalog/index.ts",
		'export { validate } from "./ingestion";\nexport { ALL } from "./registry";\n',
	);
	await write(
		"packages/datasets/src/data/catalog/ingestion.ts",
		"export const validate = 1;",
	);
	await write(
		"packages/datasets/src/data/catalog/registry.ts",
		'import { alpha } from "./definitions/alpha";\nimport { beta } from "./definitions/beta";\n',
	);
	await write(
		"packages/datasets/src/data/catalog/generated.ts",
		"// generated",
	);
	await write(
		"packages/datasets/src/data/catalog/definitions/index.ts",
		'export * from "./alpha";\nexport * from "./beta";\n',
	);
	await write(
		"packages/datasets/src/data/catalog/definitions/alpha.ts",
		definition("alpha", 'import { load } from "../../alpha/loader";'),
	);
	await write(
		"packages/datasets/src/data/catalog/definitions/beta.ts",
		definition("beta", 'import { load } from "@/lib/data/beta/loader";'),
	);
	await write(
		"packages/datasets/src/data/alpha/loader.ts",
		"export const load = 'alpha';",
	);
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

	it("fingerprints datasets alone without the website's lookups", async () => {
		const { datasets } = await precompileFingerprints(root);
		await unlink(
			join(
				root,
				"data/build/atlas-assets/atlas-lookups/boundary-mappings.json.gz",
			),
		);
		await unlink(
			join(
				root,
				"data/build/atlas-assets/atlas-lookups/parish-lad-mappings.json.gz",
			),
		);

		expect(await datasetFingerprints(root)).toEqual(datasets);
	});

	it("is stable while nothing changes", async () => {
		expect(await precompileFingerprints(root)).toEqual(
			await precompileFingerprints(root),
		);
	});

	it("ignores generated output reached through compiler imports", async () => {
		await write(
			"scripts/compile-website-data.mts",
			'import core from "../public/data/datasets/gazetteer.core.json";',
		);
		const before = await precompileFingerprints(root);
		await write(
			"public/data/datasets/gazetteer.core.json",
			'{"version":1}',
		);
		expect(await precompileFingerprints(root)).toEqual(before);
		await write(
			"public/data/datasets/gazetteer.core.json",
			'{"version":2}',
		);
		expect(await precompileFingerprints(root)).toEqual(before);
	});

	it("resolves imports afresh when a preferred extension appears", async () => {
		await write(
			"packages/datasets/src/data/catalog/definitions/alpha.ts",
			definition(
				"alpha",
				'import { load } from "../../alpha/new-loader";',
			),
		);
		await write(
			"packages/datasets/src/data/alpha/new-loader.js",
			"export const load = 1;",
		);
		const before = await datasetFingerprints(root);
		await write(
			"packages/datasets/src/data/alpha/new-loader.ts",
			"export const load = 2;",
		);
		const after = await datasetFingerprints(root);

		expect(after.alpha).not.toEqual(before.alpha);
		expect(after.beta).toEqual(before.beta);
	});

	it("changes only a dataset's own fingerprint when its loader changes", async () => {
		const before = await precompileFingerprints(root);
		await write(
			"packages/datasets/src/data/alpha/loader.ts",
			"export const load = 'new';",
		);
		const after = await precompileFingerprints(root);

		expect(after.datasets.alpha).not.toEqual(before.datasets.alpha);
		expect(after.datasets.beta).toEqual(before.datasets.beta);
		expect(after.pipeline).toEqual(before.pipeline);
	});

	it("follows workspace package subpath exports to a loader", async () => {
		await write(
			"packages/datasets/package.json",
			JSON.stringify({ exports: { "./*": "./src/*.ts" } }),
		);
		await write(
			"packages/datasets/src/data/catalog/definitions/alpha.ts",
			definition(
				"alpha",
				'import { load } from "@uk-data-atlas/datasets/data/alpha/loader";',
			),
		);
		const before = await precompileFingerprints(root);
		await write(
			"packages/datasets/src/data/alpha/loader.ts",
			"export const load = 'changed';",
		);
		const after = await precompileFingerprints(root);
		expect(after.datasets.alpha).not.toEqual(before.datasets.alpha);
		expect(after.datasets.beta).toEqual(before.datasets.beta);
	});

	it("changes only a dataset's own fingerprint when its definition changes", async () => {
		const before = await precompileFingerprints(root);
		await write(
			"packages/datasets/src/data/catalog/definitions/beta.ts",
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
			"packages/datasets/src/data/catalog/definitions/gamma.ts",
			definition("gamma"),
		);
		await write(
			"packages/datasets/src/data/catalog/registry.ts",
			'import { gamma } from "./definitions/gamma";\n',
		);
		await write(
			"packages/datasets/src/data/catalog/generated.ts",
			"// regenerated",
		);
		const after = await precompileFingerprints(root);

		expect(Object.keys(after.datasets)).toEqual(["alpha", "beta", "gamma"]);
		expect(after.datasets.alpha).toEqual(before.datasets.alpha);
		expect(after.datasets.beta).toEqual(before.datasets.beta);
		expect(after.pipeline).toEqual(before.pipeline);
	});

	it("changes the pipeline, not the datasets, when pipeline code changes", async () => {
		const before = await precompileFingerprints(root);
		await write("pipeline/src/precompile/cache.mts", "// edited");
		const after = await precompileFingerprints(root);

		expect(after.pipeline).not.toEqual(before.pipeline);
		expect(after.datasets).toEqual(before.datasets);
	});

	it("refuses two definitions that declare the same type", async () => {
		await write(
			"packages/datasets/src/data/catalog/definitions/gamma.ts",
			definition("alpha"),
		);

		await expect(precompileFingerprints(root)).rejects.toThrow(
			"Two dataset definitions declare the type alpha",
		);
	});
});
