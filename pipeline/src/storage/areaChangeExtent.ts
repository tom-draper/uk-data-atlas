import type { DatabaseSync } from "node:sqlite";
import type { Step } from "../conversion/crosswalkSteps.ts";
import { createRouter, type Hop } from "../conversion/routes.ts";

/**
 * How much each area changed between consecutive boundary releases:
 * `area_change_extent`, `area_change_extent_pair` and `v_area_change_extent`.
 * Written at atlas assembly, after the crosswalks and their weights on every
 * basis are in `main`.
 *
 * Each release of a geography is paired with the nearest release of a later
 * vintage (reference year and month) that one hop of the converter's routes
 * joins it to. The hop's population step, the converter's own, says where each
 * area's residents went. Nothing here decides a weight.
 *
 * An area persists into its successor in the later release: the area with the
 * same code where there is one, and otherwise the target that takes most of
 * its residents, where the area also gives that target more of its residents
 * than any other feeder (`largest-share`). An area with neither ended.
 *
 * Residents: `residents_lost` is the share of the area's residents that moved
 * to another area (1 minus the population weight of the edge to the
 * successor), and `residents_gained` the share of the successor's residents
 * that came from elsewhere (1 minus its population target share).
 *
 * Land: an edge of the extent-continuity crosswalk is the same extent within
 * generalisation noise, so it changed no land (`continuous`). An area the
 * extent-continuity check measured as redrawn or realigned has its measured
 * overlap shares (`measured`). An edge with an `area` basis weight has that
 * (`area-weight`). Anything else has no land figure.
 */

/** A share of residents or land this large or larger is a material change. */
export const MATERIAL_SHARE = 0.05;

const TABLES = `
CREATE TABLE area_change_extent_pair (
	from_release_id INTEGER NOT NULL REFERENCES area_release(id),
	to_release_id INTEGER NOT NULL REFERENCES area_release(id),
	crosswalks TEXT NOT NULL,
	reversed INTEGER NOT NULL CHECK (reversed IN (0, 1)),
	sources INTEGER NOT NULL CHECK (sources >= 0),
	persisting INTEGER NOT NULL CHECK (persisting >= 0),
	ended INTEGER NOT NULL CHECK (ended >= 0),
	blocked INTEGER NOT NULL CHECK (blocked >= 0),
	unlinked INTEGER NOT NULL CHECK (unlinked >= 0),
	PRIMARY KEY (from_release_id, to_release_id)
) WITHOUT ROWID, STRICT;
CREATE TABLE area_change_extent (
	from_version_id INTEGER NOT NULL REFERENCES area_version(id),
	to_version_id INTEGER NOT NULL REFERENCES area_version(id),
	successor TEXT NOT NULL CHECK (successor IN ('same-code', 'largest-share')),
	residents_lost REAL CHECK (residents_lost BETWEEN 0 AND 1),
	residents_gained REAL CHECK (residents_gained BETWEEN 0 AND 1),
	land_lost REAL CHECK (land_lost BETWEEN 0 AND 1),
	land_gained REAL CHECK (land_gained BETWEEN 0 AND 1),
	land_basis TEXT CHECK (land_basis IN ('continuous', 'measured', 'area-weight')),
	PRIMARY KEY (from_version_id, to_version_id)
) WITHOUT ROWID, STRICT;`;

/**
 * One readable row per persisting area, with `materially_changed`: 1 where any
 * known share reaches `MATERIAL_SHARE`, 0 where the residents shares are known
 * and every known share is below it, and null where nothing says.
 */
export const AREA_CHANGE_EXTENT_VIEW = `
SELECT fr.geography, fr.release AS from_release, tr.release AS to_release,
  fa.code AS from_code, fv.name AS from_name,
  ta.code AS to_code, tv.name AS to_name, x.successor,
  x.residents_lost, x.residents_gained, x.land_lost, x.land_gained, x.land_basis,
  CASE
    WHEN max(coalesce(x.residents_lost, 0), coalesce(x.residents_gained, 0),
      coalesce(x.land_lost, 0), coalesce(x.land_gained, 0)) >= ${MATERIAL_SHARE} THEN 1
    WHEN x.residents_lost IS NOT NULL AND x.residents_gained IS NOT NULL THEN 0
  END AS materially_changed,
  x.from_version_id, x.to_version_id,
  fv.release_id AS from_release_id, tv.release_id AS to_release_id
FROM area_change_extent x
JOIN area_version fv ON fv.id = x.from_version_id
JOIN area fa ON fa.id = fv.area_id
JOIN area_release fr ON fr.id = fv.release_id
JOIN area_version tv ON tv.id = x.to_version_id
JOIN area ta ON ta.id = tv.area_id
JOIN area_release tr ON tr.id = tv.release_id`;

export type LandChange = {
	lost: number | null;
	gained: number | null;
	basis: "continuous" | "measured" | "area-weight";
};

export type ExtentRow = {
	from: number;
	to: number;
	successor: "same-code" | "largest-share";
	residentsLost: number | null;
	residentsGained: number | null;
	land: LandChange | undefined;
};

export type PairInput = {
	/** The hop's step on the population basis. */
	step: Step;
	/** The area (code) of every version on either side. */
	areaOf: ReadonlyMap<number, number>;
	/** The share of the target's residents that came from the source, where held. */
	targetShare: (from: number, to: number) => number | undefined;
	/** How the land of an edge changed, where known. */
	land: (from: number, to: number, crosswalk: number | undefined) =>
		LandChange | undefined;
};

const clamp = (share: number) => Math.min(1, Math.max(0, share));

/** The successor of each area of one step, and the areas that ended. */
export const measurePair = ({ step, areaOf, targetShare, land }: PairInput) => {
	const rows: ExtentRow[] = [];
	const ended: number[] = [];
	const sameCode = (from: number, targets: readonly number[]) =>
		targets.find((to) => areaOf.get(to) === areaOf.get(from));
	// The share of a target's residents a source gave it. A target with one
	// feeder took them all.
	const shareOf = (from: number, to: number) =>
		targetShare(from, to) ??
		((step.feeders.get(to) ?? []).length === 1 ? 1 : undefined);
	for (const [from, edges] of step.edges) {
		let successor: ExtentRow["successor"] = "same-code";
		let edge = edges.find((made) => areaOf.get(made.to) === areaOf.get(from));
		if (!edge) {
			successor = "largest-share";
			const best = edges.reduce((held, made) =>
				made.weight > held.weight ? made : held,
			);
			const mine = shareOf(from, best.to);
			const others = (step.feeders.get(best.to) ?? []).filter(
				(feeder) => feeder !== from,
			);
			// The target is the area's successor only if the area is the
			// target's largest feeder, and no other feeder kept its code into it.
			if (
				mine === undefined ||
				others.some((feeder) => {
					if (areaOf.get(feeder) === areaOf.get(best.to)) return true;
					const theirs = shareOf(feeder, best.to);
					return theirs === undefined || theirs > mine;
				})
			) {
				ended.push(from);
				continue;
			}
			edge = best;
		}
		const gained = shareOf(from, edge.to);
		rows.push({
			from,
			to: edge.to,
			successor,
			residentsLost: clamp(1 - edge.weight),
			residentsGained: gained === undefined ? null : clamp(1 - gained),
			land: land(from, edge.to, edge.crosswalk),
		});
	}
	// An area that cannot be carried keeps a row where its code persists, with
	// no residents figures.
	for (const [from, { targets }] of step.blocked) {
		const to = sameCode(from, targets);
		if (to === undefined) continue;
		rows.push({
			from,
			to,
			successor: "same-code",
			residentsLost: null,
			residentsGained: null,
			land: land(from, to, undefined),
		});
	}
	return { rows, ended };
};

type Measured = { code: string; sourceShare: number; targetShare: number };
type ContinuityValidation = {
	changedExtent?: Measured[];
	realigned?: Array<Measured & { successor: string }>;
};

type Release = {
	id: number;
	geography: string;
	release: string;
	vintage: number;
};

export type AreaChangeExtentSummary = {
	pairs: number;
	rows: number;
	/** Releases with a later vintage that no one hop reaches. */
	unpaired: Array<{ geography: string; release: string }>;
};

/** The releases of each geography, oldest vintage first. */
const releasesByGeography = (database: DatabaseSync) => {
	const rows = database
		.prepare(
			`SELECT id, geography, release,
				coalesce(reference_year, 0) * 100 + coalesce(reference_month, 0) AS vintage
			FROM area_release ORDER BY geography, vintage, inventory_position DESC`,
		)
		.all() as Release[];
	const grouped = new Map<string, Release[]>();
	for (const row of rows) {
		const held = grouped.get(row.geography);
		if (held) held.push(row);
		else grouped.set(row.geography, [row]);
	}
	return grouped;
};

/**
 * Writes the tables and the view. Needs every weight basis in
 * `crosswalk_weight`, so an atlas without crosswalk weights should not call it.
 */
export const writeAreaChangeExtent = (
	database: DatabaseSync,
): AreaChangeExtentSummary => {
	database.exec(TABLES);
	database.exec(
		`CREATE VIEW v_area_change_extent AS ${AREA_CHANGE_EXTENT_VIEW}`,
	);
	const router = createRouter(database);
	const versionsOf = database.prepare(
		"SELECT v.id, v.area_id, a.code, v.in_inventory FROM area_version v JOIN area a ON a.id = v.area_id WHERE v.release_id = ?",
	);
	const weightsOf = database.prepare(
		"SELECT from_version_id AS f, to_version_id AS t, weight, target_share FROM crosswalk_weight WHERE crosswalk_id = ? AND basis_id = ?",
	);
	const continuityOf = database.prepare(
		`SELECT from_release_id AS fromRelease, validation FROM crosswalk
		WHERE method = 'extent-continuity'
			AND ((from_release_id = ?1 AND to_release_id = ?2) OR (from_release_id = ?2 AND to_release_id = ?1))`,
	);
	const insertPair = database.prepare(
		"INSERT INTO area_change_extent_pair VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	);
	const insertRow = database.prepare(
		"INSERT INTO area_change_extent VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
	);
	const summary: AreaChangeExtentSummary = { pairs: 0, rows: 0, unpaired: [] };

	const measure = (from: Release, to: Release, hop: Hop) => {
		type Version = { id: number; area_id: number; code: string; in_inventory: number };
		const before = versionsOf.all(from.id) as Version[];
		const after = versionsOf.all(to.id) as Version[];
		const areaOf = new Map(
			[...before, ...after].map((row) => [row.id, row.area_id]),
		);
		const beforeByCode = new Map(before.map((row) => [row.code, row.id]));
		const afterByCode = new Map(after.map((row) => [row.code, row.id]));
		const key = (source: number, target: number) => `${source}>${target}`;
		// Weights are held from the crosswalk's source to its target, so a
		// reversed hop reads them the other way round.
		const shares = (basis: string) => {
			const held = new Map<string, { forward: number; back: number | null }>();
			for (const crosswalk of hop.crosswalks)
				for (const row of weightsOf.all(crosswalk, basis) as Array<{
					f: number;
					t: number;
					weight: number;
					target_share: number | null;
				}>)
					held.set(
						hop.reversed ? key(row.t, row.f) : key(row.f, row.t),
						hop.reversed
							? { forward: row.target_share ?? Number.NaN, back: row.weight }
							: { forward: row.weight, back: row.target_share },
					);
			return held;
		};
		const population = shares("population");
		const area = shares("area");

		const measured = new Map<string, LandChange>();
		for (const { fromRelease, validation } of continuityOf.all(
			from.id,
			to.id,
		) as Array<{ fromRelease: number; validation: string | null }>) {
			const continuity = (
				JSON.parse(validation ?? "{}") as { continuity?: ContinuityValidation }
			).continuity;
			if (!continuity) continue;
			const forward = fromRelease === from.id;
			const record = (entry: Measured, successor: string) => {
				const [sourceCode, targetCode] = forward
					? [entry.code, successor]
					: [successor, entry.code];
				const source = beforeByCode.get(sourceCode);
				const target = afterByCode.get(targetCode);
				if (source === undefined || target === undefined) return;
				const [lost, gained] = forward
					? [entry.sourceShare, entry.targetShare]
					: [entry.targetShare, entry.sourceShare];
				measured.set(key(source, target), {
					lost: clamp(1 - lost),
					gained: clamp(1 - gained),
					basis: "measured",
				});
			};
			for (const entry of continuity.changedExtent ?? [])
				record(entry, entry.code);
			for (const entry of continuity.realigned ?? [])
				record(entry, entry.successor);
		}

		const step = router.step(hop, "population");
		const { rows, ended } = measurePair({
			step,
			areaOf,
			targetShare: (source, target) => {
				const share = population.get(key(source, target))?.back;
				return share === null || share === undefined || Number.isNaN(share)
					? undefined
					: share;
			},
			land: (source, target, crosswalk) => {
				const held = measured.get(key(source, target));
				if (held) return held;
				if (
					crosswalk !== undefined &&
					router.crosswalk(crosswalk).method === "extent-continuity"
				)
					return { lost: 0, gained: 0, basis: "continuous" };
				const weighed = area.get(key(source, target));
				if (!weighed) return undefined;
				const share = (value: number | null) =>
					value === null || Number.isNaN(value) ? null : clamp(1 - value);
				return {
					lost: share(weighed.forward),
					gained: share(weighed.back),
					basis: "area-weight",
				};
			},
		});
		for (const row of rows)
			insertRow.run(
				row.from,
				row.to,
				row.successor,
				row.residentsLost,
				row.residentsGained,
				row.land?.lost ?? null,
				row.land?.gained ?? null,
				row.land?.basis ?? null,
			);
		const sources = before.filter((row) => row.in_inventory === 1);
		const linked = (id: number) => step.edges.has(id) || step.blocked.has(id);
		insertPair.run(
			from.id,
			to.id,
			hop.crosswalks.join(","),
			hop.reversed ? 1 : 0,
			sources.length,
			rows.length,
			ended.length,
			step.blocked.size,
			sources.filter((row) => !linked(row.id)).length,
		);
		summary.pairs += 1;
		summary.rows += rows.length;
	};

	for (const [geography, releases] of releasesByGeography(database))
		releases.forEach((from, index) => {
			const later = releases.slice(index + 1).filter(
				(to) => to.vintage > from.vintage,
			);
			if (later.length === 0) return;
			for (const to of later) {
				const [route] = router.routes(from.id, to.id, 1);
				if (route) return measure(from, to, route[0]!);
			}
			summary.unpaired.push({ geography, release: from.release });
		});
	return summary;
};
