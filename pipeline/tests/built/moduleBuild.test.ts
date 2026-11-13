import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, test } from "vitest";
import {
	CORE_COMPATIBILITY_KEY,
	buildModuleManifests,
} from "@uk-data-atlas/datasets/registry";
import {
	assembleModules,
	manifestFilePath,
} from "../../src/modules/assembleModules";
import { sqlitePath } from "../../src/modules/buildModules";

/**
 * The module build against the real `data/build/atlas.sqlite`
 * (`pnpm data:build --only build-modules`): each module holds what
 * `atlas.sqlite` holds for it, and the assembled file answers the same.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const ATLAS = join(ROOT, "data/build/atlas.sqlite");
const BUILT = join(ROOT, "data/build/modules");
const scratch = mkdtempSync(join(tmpdir(), "module-built-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const open = (path: string) => new DatabaseSync(path, { readOnly: true });
const number = (database: DatabaseSync, sql: string) =>
	Number((database.prepare(sql).get() as { n: number }).n);

const registered = buildModuleManifests({ datasets: () => [] });
const requiresOf = (id: string) =>
	registered.find((manifest) => manifest.id === id)?.requires ?? [];
const addOnsOf = (id: string) =>
	registered.find((manifest) => manifest.id === id)?.addOns ?? [];

const built = existsSync(join(BUILT, "build.json"));
const buildFile = built
	? (JSON.parse(readFileSync(join(BUILT, "build.json"), "utf8")) as {
			modules: Record<string, { status: string }>;
		})
	: { modules: {} };
const modules = Object.entries(buildFile.modules)
	.filter(([id, { status }]) => status === "built" && id !== "core")
	.map(([id]) => id)
	.filter((id) => existsSync(join(BUILT, sqlitePath(id))));

/**
 * A release folder of links to the built files with stub manifests. The build
 * holds no licences; `data:dist` writes the real manifests.
 */
const prepareRelease = () => {
	const release = join(scratch, "release");
	if (existsSync(release)) return release;
	mkdirSync(join(release, "sqlite"), { recursive: true });
	for (const id of ["core", ...modules]) {
		symlinkSync(join(BUILT, sqlitePath(id)), join(release, sqlitePath(id)));
		writeFileSync(
			join(release, manifestFilePath(id)),
			JSON.stringify({
				id,
				compatibility: { core: CORE_COMPATIBILITY_KEY },
				requires: requiresOf(id),
				licenceConflict: null,
				licences: [],
			}),
		);
	}
	return release;
};

describe.runIf(built && existsSync(ATLAS))("module build", () => {
	const atlas = () => open(ATLAS);

	test("every theme module has the datasets, series and observations of its module", () => {
		const reference = atlas();
		try {
			const themes = modules.filter((id) => {
				const file = open(join(BUILT, sqlitePath(id)));
				try {
					return (
						number(
							file,
							"SELECT count(*) AS n FROM sqlite_schema WHERE name = 'dataset'",
						) > 0
					);
				} finally {
					file.close();
				}
			});
			assert.ok(themes.length > 0);
			for (const id of themes) {
				const file = open(join(BUILT, sqlitePath(id)));
				try {
					for (const [table, sql] of [
						[
							"dataset",
							`SELECT count(*) AS n FROM dataset WHERE module = '${id}'`,
						],
						[
							"series",
							`SELECT count(*) AS n FROM series WHERE dataset_id IN (SELECT id FROM dataset WHERE module = '${id}')`,
						],
						[
							"observation",
							`SELECT count(*) AS n FROM observation WHERE series_id IN (SELECT s.id FROM series s JOIN dataset d ON d.id = s.dataset_id WHERE d.module = '${id}')`,
						],
					] as const) {
						// An add-on takes some observations out of the module it adds to;
						// the two together are checked below.
						if (table === "observation" && addOnsOf(id).length > 0)
							continue;
						assert.equal(
							number(file, `SELECT count(*) AS n FROM ${table}`),
							number(reference, sql),
							`${id}.${table}`,
						);
					}
				} finally {
					file.close();
				}
			}
		} finally {
			reference.close();
		}
	});

	test("an add-on and its module together hold what atlas.sqlite holds", () => {
		const reference = atlas();
		try {
			for (const id of modules) {
				const addOns = addOnsOf(id).filter((addOn) =>
					modules.includes(addOn),
				);
				if (addOns.length === 0) continue;
				let total = 0;
				for (const part of [id, ...addOns]) {
					const file = open(join(BUILT, sqlitePath(part)));
					try {
						total += number(
							file,
							"SELECT count(*) AS n FROM observation",
						);
					} finally {
						file.close();
					}
				}
				assert.equal(
					total,
					number(
						reference,
						`SELECT count(*) AS n FROM observation WHERE series_id IN (SELECT s.id FROM series s JOIN dataset d ON d.id = s.dataset_id WHERE d.module = '${id}')`,
					),
					`${id} with ${addOns.join(", ")}`,
				);
			}
		} finally {
			reference.close();
		}
	});

	test("all modules assembled answer like atlas.sqlite", async () => {
		const release = prepareRelease();
		const out = join(scratch, "all.sqlite");
		await assembleModules({
			root: release,
			modules,
			out,
			allowLicenceConflict: true,
		});
		const reference = atlas();
		const assembled = open(out);
		try {
			for (const sql of [
				"SELECT count(*) AS n FROM dataset",
				"SELECT count(*) AS n FROM measure",
				"SELECT count(*) AS n FROM series",
				"SELECT count(*) AS n FROM observation",
				"SELECT count(*) AS n FROM series_member",
				"SELECT count(*) AS n FROM area_version",
				"SELECT count(*) AS n FROM payloads",
			])
				assert.equal(
					number(assembled, sql),
					number(reference, sql),
					sql,
				);
			const sample =
				"SELECT series_id, area_version_id, period_id, value, status_id FROM observation ORDER BY series_id, area_version_id, period_id LIMIT 5000 OFFSET 1000";
			assert.deepEqual(
				assembled.prepare(sample).all(),
				reference.prepare(sample).all(),
			);
			assert.deepEqual(
				assembled.prepare("PRAGMA foreign_key_check").all(),
				[],
			);
		} finally {
			reference.close();
			assembled.close();
			// /tmp can be a small tmpfs, so free the large file before the next test.
			rmSync(out, { force: true });
		}
	}, 1_800_000);

	test("a subset of modules assembles with every key resolving", async () => {
		const release = prepareRelease();
		const chosen = ["economy", "health", "transport"].filter((id) =>
			modules.includes(id),
		);
		assert.ok(chosen.length >= 2);
		const out = join(scratch, "subset.sqlite");
		await assembleModules({ root: release, modules: chosen, out });
		const assembled = open(out);
		try {
			assert.deepEqual(
				assembled.prepare("PRAGMA foreign_key_check").all(),
				[],
			);
			const reference = atlas();
			try {
				const sql = `SELECT count(*) AS n FROM observation WHERE series_id IN (SELECT s.id FROM series s JOIN dataset d ON d.id = s.dataset_id WHERE d.module IN (${chosen.map((id) => `'${id}'`).join(",")}))`;
				assert.equal(
					number(assembled, "SELECT count(*) AS n FROM observation"),
					number(reference, sql),
				);
			} finally {
				reference.close();
			}
		} finally {
			assembled.close();
		}
	}, 600_000);

	test("an add-on assembles with its module and not without it", async () => {
		const release = prepareRelease();
		const pairs = modules.filter(
			(id) =>
				requiresOf(id).length > 0 &&
				requiresOf(id).every((required) => modules.includes(required)),
		);
		for (const addOn of pairs) {
			const needed = requiresOf(addOn);
			await assert.rejects(
				assembleModules({
					root: release,
					modules: [addOn],
					out: join(scratch, "alone.sqlite"),
				}),
				/which is not in this assembly/,
			);
			const out = join(scratch, "pair.sqlite");
			await assembleModules({
				root: release,
				modules: [...needed, addOn],
				out,
			});
			const assembled = open(out);
			const reference = atlas();
			try {
				assert.deepEqual(
					assembled.prepare("PRAGMA foreign_key_check").all(),
					[],
				);
				const held = needed.map((id) => `'${id}'`).join(",");
				assert.equal(
					number(assembled, "SELECT count(*) AS n FROM observation"),
					number(
						reference,
						`SELECT count(*) AS n FROM observation WHERE series_id IN (SELECT s.id FROM series s JOIN dataset d ON d.id = s.dataset_id WHERE d.module IN (${held}))`,
					),
					`${needed.join(", ")} with ${addOn}`,
				);
			} finally {
				reference.close();
				assembled.close();
				rmSync(out, { force: true });
			}
		}
	}, 600_000);
});
