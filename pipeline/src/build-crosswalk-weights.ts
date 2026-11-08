import { sha256 } from "@uk-data-atlas/artifacts";
import {
	buildLog,
	formatCount,
	formatDuration,
	repoPath,
} from "@uk-data-atlas/atlas-runtime/storage";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isMainThread } from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { releaseKey } from "@uk-data-atlas/geography/postcode-area-types";
import {
	buildWeightAtoms,
	MEASURES,
	onspdEdition,
	readColumn,
	readPostcodeRows,
	type OutputAreaCounts,
	type WeightAtoms,
} from "./crosswalk-weights/atoms.ts";
import { crosswalkSetHash } from "./crosswalk-weights/crosswalkSetHash.ts";
import {
	crosswalkWeightsDirectory,
	crosswalkWeightsPath,
} from "./crosswalk-weights/paths.ts";
import { EXACT_EDGE_SQL } from "./crosswalk-weights/exactEdges.ts";
import {
	placeInRelease,
	releasesWithGeometry,
} from "./crosswalk-weights/placement.ts";
import {
	weighEdges,
	type Placement,
	type WeighedEdge,
} from "./crosswalk-weights/weigh.ts";

/**
 * Weight the edges of every crosswalk that is not exact, from the smallest
 * units held (see crosswalk-weights/atoms.ts).
 *
 * Atoms are placed in each release one at a time, in a worker that holds only
 * that release's geometry, and the placement is kept as a small file so a
 * release is placed again only when its geometry or the atoms change. A
 * crosswalk then reads the two placements it needs, one crosswalk at a time,
 * and never its artifact: the edges come from `atlas-base.sqlite`. Only the
 * rows of `crosswalk_weight` are the result, written to
 * `data/build/crosswalk-weights/crosswalk-weights.sqlite` for `assemble-atlas`
 * to copy in. Placements are an intermediate and do not ship.
 */

const OUTPUT_AREA_2021 = {
	from: { geography: "outputArea", boundaryRelease: "2021-12-ew-bgc-v2" },
	to: { geography: "lsoa", boundaryRelease: "2021-12-ew-bgc-v5" },
};

const readCounts = (root: string, base: DatabaseSync): OutputAreaCounts => {
	const source = (path: string) => join(root, "data/source", path);
	const census = (table: string, column: string) =>
		readColumn(
			source(
				`demographics/census-2021-small-area/${table}/census2021-${table}-oa.csv`,
			),
			"geography code",
			column,
		);
	const population = census(
		"ts001",
		"Residence type: Total; measures: Value",
	);
	const households = census(
		"ts003",
		"Household composition: Total; measures: Value",
	);
	for (const [code, count] of readColumn(
		source(
			"demographics/population/census-2022-scotland-output-area/outputarea2022_usualresidentpopulation.csv",
		),
		"OutputArea2022",
		"UsualResidentPopulation",
	))
		population.set(code, count);
	const centroids = new Map<string, readonly [number, number]>();
	for (const [path, column] of [
		[
			"geography/population-weighted-centroids/oa-2021-ew-v4/oa-2021-ew-pwc.csv",
			"OA21CD",
		],
		[
			"geography/population-weighted-centroids/oa-2022-sc/oa-2022-sc-pwc.csv",
			"OA22CD",
		],
	] as const) {
		const lines = readFileSync(source(path), "utf8").trim().split("\n");
		if (lines[0] !== `${column},longitude,latitude`)
			throw new Error(`${path} has unexpected columns`);
		for (const line of lines.slice(1)) {
			const [code, longitude, latitude] = line.split(",");
			centroids.set(code!, [Number(longitude), Number(latitude)]);
		}
	}
	const lsoaOf = new Map<string, string>();
	for (const row of base
		.prepare(
			`SELECT fa.code AS child, ta.code AS parent
			FROM crosswalk_edge e
			JOIN crosswalk c ON c.id = e.crosswalk_id
			JOIN area_releases f ON f.position = c.from_release_id
			JOIN area_releases t ON t.position = c.to_release_id
			JOIN area_version fv ON fv.id = e.from_version_id JOIN area fa ON fa.id = fv.area_id
			JOIN area_version tv ON tv.id = e.to_version_id JOIN area ta ON ta.id = tv.area_id
			WHERE f.geography = ? AND f.id = ? AND t.geography = ? AND t.id = ?`,
		)
		.all(
			OUTPUT_AREA_2021.from.geography,
			OUTPUT_AREA_2021.from.boundaryRelease,
			OUTPUT_AREA_2021.to.geography,
			OUTPUT_AREA_2021.to.boundaryRelease,
		))
		lsoaOf.set(row.child as string, row.parent as string);
	if (lsoaOf.size === 0)
		throw new Error(
			"No output area to LSOA crosswalk to split dwellings by",
		);
	return {
		population,
		households,
		dwellings: readColumn(
			source("housing/council-tax-stock/2026/CTSOP1_1_2026_03_31.csv"),
			"ecode",
			"all_properties",
			{
				skipUnusable: true,
				only: { column: "geography", value: "LSOA" },
			},
		),
		lsoaOf,
		centroids,
	};
};

const shared = (values: Float64Array) => {
	const copy = new Float64Array(new SharedArrayBuffer(values.byteLength));
	copy.set(values);
	return copy;
};

const atomsHash = (atoms: WeightAtoms) => {
	const hash = createHash("sha256");
	for (const values of [atoms.longitude, atoms.latitude])
		hash.update(
			new Uint8Array(values.buffer, values.byteOffset, values.byteLength),
		);
	return hash.digest("hex");
};

const readPlacement = (path: string): Placement => {
	const meta = JSON.parse(readFileSync(`${path}.json`, "utf8")) as {
		codes: string[];
	};
	const bytes = readFileSync(path);
	return {
		codes: meta.codes,
		area: new Int32Array(
			bytes.buffer.slice(
				bytes.byteOffset,
				bytes.byteOffset + bytes.byteLength,
			),
		),
	};
};

export const buildCrosswalkWeights = async (
	root: string,
	options: { rebuild?: boolean } = {},
) => {
	const started = performance.now();
	const base = new DatabaseSync(join(root, "data/build/atlas-base.sqlite"), {
		readOnly: true,
	});
	try {
		const inventoryHash = crosswalkSetHash(base);
		const crosswalks = base
			.prepare(
				`SELECT c.id AS id, c.slug AS slug, c.basis_id AS basis, f.geography AS fromGeography, f.id AS fromRelease, t.geography AS toGeography, t.id AS toRelease
				FROM crosswalk c
				JOIN area_releases f ON f.position = c.from_release_id
				JOIN area_releases t ON t.position = c.to_release_id
				WHERE EXISTS (SELECT 1 FROM crosswalk_edge e WHERE e.crosswalk_id = c.id AND NOT ${EXACT_EDGE_SQL})
				ORDER BY c.id`,
			)
			.all() as Array<{
			id: number;
			slug: string;
			basis: string | null;
			fromGeography: string;
			fromRelease: string;
			toGeography: string;
			toRelease: string;
		}>;
		const inputHash = releasesWithGeometry(root);
		const counts = readCounts(root, base);
		const atoms = await buildWeightAtoms(
			counts,
			readPostcodeRows(onspdEdition(root)),
			2_800_000,
		);
		buildLog.info(
			`Weight atoms: ${formatCount(atoms.postcodes)} postcodes and ${formatCount(atoms.count - atoms.postcodes)} output areas without one`,
		);
		const longitudes = shared(atoms.longitude);
		const latitudes = shared(atoms.latitude);
		const atomsKey = atomsHash(atoms);

		// Place the atoms in each release the crosswalks need, one at a time.
		const skipped: string[] = [];
		const weighable = crosswalks.filter((crosswalk) => {
			const ends = [
				[crosswalk.fromGeography, crosswalk.fromRelease],
				[crosswalk.toGeography, crosswalk.toRelease],
			] as const;
			if (ends.every(([g, r]) => inputHash(g, r) !== undefined))
				return true;
			skipped.push(crosswalk.slug);
			return false;
		});
		const directory = crosswalkWeightsDirectory(root);
		const placements = join(directory, "placements");
		mkdirSync(placements, { recursive: true });
		const releases = new Map<
			string,
			{ geography: string; boundaryRelease: string }
		>();
		for (const crosswalk of weighable) {
			releases.set(
				releaseKey(crosswalk.fromGeography, crosswalk.fromRelease),
				{
					geography: crosswalk.fromGeography,
					boundaryRelease: crosswalk.fromRelease,
				},
			);
			releases.set(
				releaseKey(crosswalk.toGeography, crosswalk.toRelease),
				{
					geography: crosswalk.toGeography,
					boundaryRelease: crosswalk.toRelease,
				},
			);
		}
		const fileOf = (geography: string, boundaryRelease: string) =>
			join(placements, `${geography}__${boundaryRelease}.i32`);
		const keep = new Set<string>();
		for (const { geography, boundaryRelease } of releases.values()) {
			const file = fileOf(geography, boundaryRelease);
			keep.add(file).add(`${file}.json`);
			const key = sha256(
				`${atomsKey}\n${inputHash(geography, boundaryRelease)}`,
			);
			const current =
				!options.rebuild && existsSync(`${file}.json`)
					? (JSON.parse(readFileSync(`${file}.json`, "utf8")) as {
							key: string;
						})
					: undefined;
			if (current?.key === key && existsSync(file)) {
				buildLog.detail(
					`Reused ${releaseKey(geography, boundaryRelease)}`,
				);
				continue;
			}
			const result = await placeInRelease({
				root,
				geography,
				boundaryRelease,
				longitudes: longitudes.buffer as SharedArrayBuffer,
				latitudes: latitudes.buffer as SharedArrayBuffer,
			});
			writeFileSync(
				file,
				new Uint8Array(
					result.area.buffer,
					result.area.byteOffset,
					result.area.byteLength,
				),
			);
			writeFileSync(
				`${file}.json`,
				JSON.stringify({ key, codes: result.codes }),
			);
			buildLog.detail(
				`Placed ${releaseKey(geography, boundaryRelease)} in ${formatDuration(result.seconds * 1000)}`,
			);
		}

		const edgesOf = base.prepare(
			`SELECT e.from_version_id AS fromVersion, e.to_version_id AS toVersion, fa.code AS fromCode, ta.code AS toCode, ${EXACT_EDGE_SQL} AS exact
			FROM crosswalk_edge e
			JOIN crosswalk c ON c.id = e.crosswalk_id
			JOIN area_version fv ON fv.id = e.from_version_id JOIN area fa ON fa.id = fv.area_id
			JOIN area_version tv ON tv.id = e.to_version_id JOIN area ta ON ta.id = tv.area_id
			WHERE e.crosswalk_id = ?`,
		);
		mkdirSync(directory, { recursive: true });
		const output = crosswalkWeightsPath(root);
		const pending = `${output}.${process.pid}.tmp`;
		rmSync(pending, { force: true });
		const result = new DatabaseSync(pending);
		const summary: Array<{
			slug: string;
			edges: number;
			exact: number;
			weighted: Record<string, number>;
		}> = [];
		try {
			result.exec(`
				PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;
				CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
				CREATE TABLE crosswalk_weight (crosswalk_id INTEGER NOT NULL, from_version_id INTEGER NOT NULL, to_version_id INTEGER NOT NULL, basis_id TEXT NOT NULL, weight REAL NOT NULL, overlap REAL, source_share REAL, target_share REAL, PRIMARY KEY (crosswalk_id, from_version_id, to_version_id, basis_id)) WITHOUT ROWID;
				BEGIN`);
			const insert = result.prepare(
				"INSERT INTO crosswalk_weight VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			);
			for (const crosswalk of weighable) {
				const edges = edgesOf.all(crosswalk.id).map((row) => ({
					fromVersion: row.fromVersion as number,
					toVersion: row.toVersion as number,
					fromCode: row.fromCode as string,
					toCode: row.toCode as string,
					exact: row.exact === 1,
				})) as WeighedEdge[];
				const rows = weighEdges(
					atoms.measures,
					readPlacement(
						fileOf(crosswalk.fromGeography, crosswalk.fromRelease),
					),
					readPlacement(
						fileOf(crosswalk.toGeography, crosswalk.toRelease),
					),
					edges,
					new Set(crosswalk.basis === null ? [] : [crosswalk.basis]),
				);
				const weighted: Record<string, number> = {};
				for (const row of rows) {
					insert.run(
						crosswalk.id,
						row.fromVersion,
						row.toVersion,
						row.basis,
						row.weight,
						row.overlap,
						row.sourceShare,
						row.targetShare,
					);
					weighted[row.basis] = (weighted[row.basis] ?? 0) + 1;
				}
				summary.push({
					slug: crosswalk.slug,
					edges: edges.length,
					exact: edges.filter((edge) => edge.exact).length,
					weighted,
				});
			}
			const meta = result.prepare("INSERT INTO meta VALUES (?, ?)");
			meta.run("crosswalk_inventory_hash", inventoryHash);
			meta.run(
				"summary",
				JSON.stringify({
					atoms: {
						postcodes: atoms.postcodes,
						outputAreas: atoms.count - atoms.postcodes,
						totals: atoms.totals,
					},
					crosswalks: summary,
					skipped,
				}),
			);
			result.exec("COMMIT");
		} finally {
			result.close();
		}
		renameSync(pending, output);
		// Placements of releases no crosswalk needs any more.
		for (const name of readdirSyncSafe(placements))
			if (!keep.has(join(placements, name)))
				rmSync(join(placements, name), { force: true });
		return {
			output,
			summary,
			skipped,
			atoms,
			seconds: (performance.now() - started) / 1000,
		};
	} finally {
		base.close();
	}
};

const readdirSyncSafe = (path: string) => {
	try {
		return readdirSync(path);
	} catch {
		return [];
	}
};

const scriptPath = fileURLToPath(import.meta.url);
if (
	isMainThread &&
	process.argv[1] &&
	resolve(process.argv[1]) === scriptPath
) {
	const { output, summary, skipped, atoms, seconds } =
		await buildCrosswalkWeights(resolve(dirname(scriptPath), ".."), {
			rebuild: process.argv.includes("--rebuild"),
		});
	for (const measure of MEASURES)
		buildLog.info(
			`${measure}: ${formatCount(Math.round(atoms.totals[measure].allocated))} of ${formatCount(Math.round(atoms.totals[measure].held))} held reached an atom`,
		);
	if (skipped.length > 0)
		buildLog.info(
			`No geometry for ${formatCount(skipped.length)} crosswalks`,
		);
	buildLog.info(
		`Weighted ${formatCount(summary.filter((entry) => Object.keys(entry.weighted).length > 0).length)} crosswalks in ${formatDuration(seconds * 1000)}, to ${repoPath(output)}`,
	);
}
