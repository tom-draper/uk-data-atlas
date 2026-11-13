import {
	DATASET_SPLIT_MODULES,
	type ModuleBuild,
	type ModuleManifest,
} from "@uk-data-atlas/datasets/registry";
import { formatBytes } from "./dist-modules.mts";

/**
 * Size per module (docs/data-organisation.md, task 16): rows and bytes of each
 * module's SQLite file and Parquet folder, read from the `build.json` a module
 * build writes. Pure, so the same build gives the same report.
 */

export interface ModuleSize {
	id: string;
	datasets: number;
	/** Rows of the `observation` table, the bulk of most modules. */
	observations: number;
	/** Rows of every table in the module's SQLite file. */
	rows: number;
	sqliteBytes: number;
	parquetBytes: number;
	parquetFiles: number;
}

/** Tables that are not data: the payload store and the build's own info. */
const NOT_DATA = new Set(["payloads", "module_info"]);

export const moduleSizes = (
	builds: Readonly<Record<string, ModuleBuild>>,
	manifests: readonly ModuleManifest[],
): ModuleSize[] =>
	Object.entries(builds).flatMap(([id, build]) => {
		if (build.status !== "built") return [];
		const parquet = build.files.filter(
			({ format }) => format === "parquet",
		);
		return [
			{
				id,
				datasets:
					manifests.find((manifest) => manifest.id === id)?.datasets
						.length ?? 0,
				observations: build.rows.observation ?? 0,
				rows: Object.entries(build.rows)
					.filter(([table]) => !NOT_DATA.has(table))
					.reduce((sum, [, count]) => sum + count, 0),
				sqliteBytes: build.bytes,
				parquetBytes: parquet.reduce(
					(sum, file) => sum + file.bytes,
					0,
				),
				parquetFiles: parquet.length,
			},
		];
	});

/**
 * The sizes as if each split module were still part of the module it was
 * split from: the split's numbers are added to its parent's. A SQLite file
 * merged this way is a sum, not a measurement, so it is close to but not
 * exactly what a single file would be.
 */
export const beforeSplits = (sizes: readonly ModuleSize[]): ModuleSize[] => {
	const parentOf = new Map<string, string>(
		DATASET_SPLIT_MODULES.map((split) => [
			split.id,
			split.requires[0] ?? split.theme,
		]),
	);
	/** An add-on holds rows of datasets its parent already counts. */
	const addOns = new Set<string>(
		DATASET_SPLIT_MODULES.filter(
			({ holds }) => holds === "licensed-rows",
		).map(({ id }) => id),
	);
	const merged = new Map<string, ModuleSize>();
	for (const size of sizes) {
		const id = parentOf.get(size.id) ?? size.id;
		const held = merged.get(id);
		merged.set(
			id,
			held
				? {
						id,
						datasets:
							held.datasets +
							(addOns.has(size.id) ? 0 : size.datasets),
						observations: held.observations + size.observations,
						rows: held.rows + size.rows,
						sqliteBytes: held.sqliteBytes + size.sqliteBytes,
						parquetBytes: held.parquetBytes + size.parquetBytes,
						parquetFiles: held.parquetFiles + size.parquetFiles,
					}
				: { ...size, id },
		);
	}
	return [...merged.values()];
};

const number = (value: number) => value.toLocaleString("en-GB");

/** A Markdown table, largest module first. */
export const renderSizes = (sizes: readonly ModuleSize[]): string => {
	const rows = [...sizes].sort(
		(a, b) =>
			b.sqliteBytes + b.parquetBytes - (a.sqliteBytes + a.parquetBytes),
	);
	return [
		"| Module | Datasets | Observations | All rows | SQLite | Parquet | Total |",
		"| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
		...rows.map(
			(size) =>
				`| \`${size.id}\` | ${size.datasets} | ${number(size.observations)} | ${number(size.rows)} | ${formatBytes(size.sqliteBytes)} | ${formatBytes(size.parquetBytes)} | ${formatBytes(size.sqliteBytes + size.parquetBytes)} |`,
		),
		"",
	].join("\n");
};
