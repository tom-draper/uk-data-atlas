import { isMainModule } from "./lib/entrypoint.ts";
import { parseScriptArgs } from "./lib/args.ts";
import {
	buildLog,
	formatCount,
	formatDuration,
	repoPath,
} from "@uk-data-atlas/atlas-db";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isMainThread } from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { releaseKey } from "@uk-data-atlas/geography";
import { MEASURES } from "./crosswalk-weights/atoms.ts";
import { crosswalkSetHash } from "./crosswalk-weights/crosswalkSetHash.ts";
import {
	crosswalkWeightsDirectory,
	crosswalkWeightsPath,
} from "./crosswalk-weights/paths.ts";
import {
	EXACT_EDGE_SQL,
	SINGLE_TARGET_SQL,
} from "./crosswalk-weights/exactEdges.ts";
import { readWeightAtoms } from "./crosswalk-weights/inputs.ts";
import { releasesWithGeometry } from "./crosswalk-weights/placement.ts";
import {
	atomsKey,
	ensurePlacements,
	placementFile,
	readPlacement,
} from "./crosswalk-weights/placements.ts";
import { weightAtomsDirectory } from "./crosswalk-weights/storedAtoms.ts";
import { weighEdges, type WeighedEdge } from "./crosswalk-weights/weigh.ts";

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
				`SELECT c.id AS id, c.slug AS slug, c.basis_id AS basis, f.geography AS fromGeography, f.release AS fromRelease, t.geography AS toGeography, t.release AS toRelease
				FROM crosswalk c
				JOIN area_releases f ON f.id = c.from_release_id
				JOIN area_releases t ON t.id = c.to_release_id
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
		const atoms = await readWeightAtoms(root);
		buildLog.info(
			`Weight atoms: ${formatCount(atoms.postcodes)} postcodes and ${formatCount(atoms.count - atoms.postcodes)} output areas without one`,
		);
		const key = atomsKey(atoms);

		// Place the atoms in each release the crosswalks need, one at a time,
		// except those `weight-atoms` already placed.
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
		const directories = [
			placements,
			join(weightAtomsDirectory(root), "placements"),
		];
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
		await ensurePlacements(
			root,
			atoms,
			[...releases.values()],
			directories,
			{
				rebuild: options.rebuild,
				onPlaced: ({ geography, boundaryRelease }, seconds) =>
					buildLog.detail(
						seconds === undefined
							? `Reused ${releaseKey(geography, boundaryRelease)}`
							: `Placed ${releaseKey(geography, boundaryRelease)} in ${formatDuration(seconds * 1000)}`,
					),
			},
		);
		const placementOf = (geography: string, boundaryRelease: string) => {
			const found = readPlacement(
				directories,
				geography,
				boundaryRelease,
				{
					atomsKey: key,
					geometryInput: inputHash(geography, boundaryRelease)!,
				},
			);
			if (!found)
				throw new Error(
					`No placement of ${geography}/${boundaryRelease}`,
				);
			return found;
		};

		const edgesOf = base.prepare(
			`SELECT e.from_version_id AS fromVersion, e.to_version_id AS toVersion, fa.code AS fromCode, ta.code AS toCode, ${EXACT_EDGE_SQL} AS exact, ${SINGLE_TARGET_SQL} AS single
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
			singleTarget: number;
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
				const found = edgesOf.all(crosswalk.id);
				// Exact and single-target edges need no rows: the view implies them.
				const edges = found.map((row) => ({
					fromVersion: row.fromVersion as number,
					toVersion: row.toVersion as number,
					fromCode: row.fromCode as string,
					toCode: row.toCode as string,
					exact: row.exact === 1 || row.single === 1,
				})) as WeighedEdge[];
				const rows = weighEdges(
					atoms.measures,
					placementOf(crosswalk.fromGeography, crosswalk.fromRelease),
					placementOf(crosswalk.toGeography, crosswalk.toRelease),
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
					exact: found.filter((row) => row.exact === 1).length,
					singleTarget: found.filter(
						(row) => row.exact !== 1 && row.single === 1,
					).length,
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
		const keep = new Set(
			[...releases.values()].flatMap(({ geography, boundaryRelease }) => {
				const file = placementFile(
					placements,
					geography,
					boundaryRelease,
				);
				return [file, `${file}.json`];
			}),
		);
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
if (isMainThread && isMainModule(import.meta.url)) {
	const { output, summary, skipped, atoms, seconds } =
		await buildCrosswalkWeights(resolve(dirname(scriptPath), "../.."), {
			rebuild:
				parseScriptArgs({ rebuild: { type: "boolean" } }).values
					.rebuild === true,
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
