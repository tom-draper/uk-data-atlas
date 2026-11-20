import type { DatabaseSync } from "node:sqlite";
import { chainsBetween, type Chain } from "../conversion/chains.ts";
import { boundsOf } from "../conversion/errorModel.ts";
import { estimatedShareOf } from "../conversion/storeConverted.ts";
import { createRouter } from "../conversion/routes.ts";
import type { IdRegistries } from "../ids/idRegistries.ts";

/**
 * Old code to current code in one join: `crosswalk_chain`,
 * `crosswalk_chain_hop`, `crosswalk_chain_edge`, `crosswalk_chain_gap` and
 * `v_crosswalk_chain_edge`. Written at atlas assembly, after the crosswalks,
 * their weights on every basis and `conversion_error` are in `main`.
 *
 * For each geography, every release other than the current one (the lowest
 * `area_release.inventory_position`) is joined to the current release by the
 * route the converter would take. The route's steps are collapsed into one
 * edge from each old area to each current area it reaches, with the combined
 * weight and the error the steps add up to. Nothing here decides how a weight
 * composes: `conversion/chains.ts` does, with the converter's own arithmetic.
 *
 * A chain that is the same on all four conversion bases (an exact regrouping
 * weighs 1 whatever the basis) is stored once, with a null `basis_id`, which
 * `v_crosswalk_chain_edge` reads as every basis.
 */

const TABLES = `
CREATE TABLE crosswalk_chain (
	id INTEGER PRIMARY KEY,
	from_release_id INTEGER NOT NULL REFERENCES area_release(id),
	to_release_id INTEGER NOT NULL REFERENCES area_release(id),
	basis_id TEXT REFERENCES weight_basis(id),
	hops INTEGER NOT NULL CHECK (hops >= 1),
	exact INTEGER NOT NULL CHECK (exact IN (0, 1)),
	edges INTEGER NOT NULL CHECK (edges >= 0),
	gaps INTEGER NOT NULL CHECK (gaps >= 0)
) STRICT;
CREATE INDEX crosswalk_chain_releases ON crosswalk_chain (from_release_id, to_release_id);
CREATE TABLE crosswalk_chain_hop (
	chain_id INTEGER NOT NULL REFERENCES crosswalk_chain(id),
	position INTEGER NOT NULL CHECK (position >= 1),
	crosswalk_id INTEGER NOT NULL REFERENCES crosswalk(id),
	reversed INTEGER NOT NULL CHECK (reversed IN (0, 1)),
	PRIMARY KEY (chain_id, position, crosswalk_id)
) WITHOUT ROWID, STRICT;
CREATE TABLE crosswalk_chain_edge (
	chain_id INTEGER NOT NULL REFERENCES crosswalk_chain(id),
	from_version_id INTEGER NOT NULL REFERENCES area_version(id),
	to_version_id INTEGER NOT NULL REFERENCES area_version(id),
	weight REAL NOT NULL CHECK (weight >= 0),
	at_risk REAL NOT NULL CHECK (at_risk >= 0),
	pruned REAL NOT NULL CHECK (pruned >= 0),
	estimated_share REAL NOT NULL CHECK (estimated_share BETWEEN 0 AND 1),
	weight_lower REAL,
	weight_upper REAL,
	complete INTEGER NOT NULL CHECK (complete IN (0, 1)),
	PRIMARY KEY (chain_id, from_version_id, to_version_id)
) WITHOUT ROWID, STRICT;
CREATE TABLE crosswalk_chain_gap (
	chain_id INTEGER NOT NULL REFERENCES crosswalk_chain(id),
	from_version_id INTEGER NOT NULL REFERENCES area_version(id),
	reason TEXT NOT NULL,
	PRIMARY KEY (chain_id, from_version_id)
) WITHOUT ROWID, STRICT;`;

/** The bases a chain with a null `basis_id` stands for. */
const CHAIN_BASES = "('population', 'households', 'dwellings', 'postcodes')";

/**
 * One readable row per (old area, current area, basis). A chain stored once for
 * every basis is read once for each of the four.
 */
export const CROSSWALK_CHAIN_EDGE_VIEW = `
SELECT r.geography, r.release AS from_release, tr.release AS to_release,
  b.id AS basis, fa.code AS from_code, fv.name AS from_name,
  ta.code AS to_code, tv.name AS to_name,
  e.weight, e.weight_lower, e.weight_upper, e.at_risk, e.pruned,
  e.estimated_share, e.complete, c.hops, c.exact,
  e.chain_id, e.from_version_id, e.to_version_id
FROM crosswalk_chain_edge e
JOIN crosswalk_chain c ON c.id = e.chain_id
JOIN area_release r ON r.id = c.from_release_id
JOIN area_release tr ON tr.id = c.to_release_id
JOIN weight_basis b ON b.id IN ${CHAIN_BASES} AND (c.basis_id IS NULL OR c.basis_id = b.id)
JOIN area_version fv ON fv.id = e.from_version_id
JOIN area fa ON fa.id = fv.area_id
JOIN area_version tv ON tv.id = e.to_version_id
JOIN area ta ON ta.id = tv.area_id`;

export type CrosswalkChainSummary = {
	chains: number;
	edges: number;
	gaps: number;
	/** Geographies with an old release that no route joins to the current one. */
	unrouted: Array<{ geography: string; release: string }>;
};

const tableExists = (database: DatabaseSync, name: string) =>
	database
		.prepare(
			"SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?",
		)
		.get(name) !== undefined;

/** The factors of the backtest for a total population, by `method|basis`. */
const readFactors = (database: DatabaseSync) =>
	new Map(
		(tableExists(database, "conversion_error")
			? (database
					.prepare(
						"SELECT method, basis_id AS basis, factor FROM conversion_error WHERE measure_class = 'total population'",
					)
					.all() as Array<{
					method: string;
					basis: string;
					factor: number;
				}>)
			: []
		).map((row) => [`${row.method}|${row.basis}`, row.factor]),
	);

/** The releases of each geography, current first. */
const releasesByGeography = (database: DatabaseSync) => {
	const rows = database
		.prepare(
			"SELECT id, geography, release FROM area_release ORDER BY geography, inventory_position",
		)
		.all() as Array<{ id: number; geography: string; release: string }>;
	const grouped = new Map<string, typeof rows>();
	for (const row of rows) {
		const held = grouped.get(row.geography);
		if (held) held.push(row);
		else grouped.set(row.geography, [row]);
	}
	return grouped;
};

/**
 * Writes the chain tables and the view. Needs every weight basis in
 * `crosswalk_weight` and, for bounds, `conversion_error`, so call it after the
 * converted series are copied. An atlas without crosswalk weights should not
 * call it: a chain would carry the splits of one basis alone.
 */
export const writeCrosswalkChains = (
	database: DatabaseSync,
	ids: IdRegistries,
): CrosswalkChainSummary => {
	database.exec(TABLES);
	database.exec(
		`CREATE VIEW v_crosswalk_chain_edge AS ${CROSSWALK_CHAIN_EDGE_VIEW}`,
	);
	const router = createRouter(database);
	const factors = readFactors(database);
	const insertChain = database.prepare(
		"INSERT INTO crosswalk_chain (id, from_release_id, to_release_id, basis_id, hops, exact, edges, gaps) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
	);
	const insertHop = database.prepare(
		"INSERT INTO crosswalk_chain_hop VALUES (?, ?, ?, ?)",
	);
	const insertEdge = database.prepare(
		"INSERT INTO crosswalk_chain_edge VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
	);
	const insertGap = database.prepare(
		"INSERT INTO crosswalk_chain_gap VALUES (?, ?, ?)",
	);
	const versionsOf = database.prepare(
		"SELECT id FROM area_version WHERE release_id = ? ORDER BY id",
	);
	const summary: CrosswalkChainSummary = {
		chains: 0,
		edges: 0,
		gaps: 0,
		unrouted: [],
	};
	const store = (
		geography: string,
		from: string,
		to: string,
		chain: Chain,
	) => {
		const basis = chain.basis;
		const id = ids.crosswalkChain.assign(
			geography,
			from,
			to,
			basis ?? "any",
		);
		insertChain.run(
			id,
			chain.fromRelease,
			chain.toRelease,
			basis,
			chain.route.reduce((sum, hop) => sum + hop.crosswalks.length, 0),
			chain.route.every((hop) => hop.exact) ? 1 : 0,
			chain.edges.length,
			chain.gaps.length,
		);
		chain.route.forEach((hop, index) => {
			for (const crosswalk of hop.crosswalks)
				insertHop.run(id, index + 1, crosswalk, hop.reversed ? 1 : 0);
		});
		for (const edge of chain.edges) {
			const methods = new Set(
				[...edge.splits].map(
					(crosswalk) => router.crosswalk(crosswalk).method,
				),
			);
			const factor =
				edge.atRisk === 0
					? 0
					: basis !== null && methods.size === 1
						? factors.get(`${[...methods][0]}|${basis}`)
						: undefined;
			const bounds =
				factor === undefined
					? undefined
					: boundsOf(
							{
								value: edge.weight,
								atRisk: edge.atRisk,
								pruned: edge.pruned,
							},
							factor,
						);
			insertEdge.run(
				id,
				edge.from,
				edge.to,
				edge.weight,
				edge.atRisk,
				edge.pruned,
				estimatedShareOf({
					value: edge.weight,
					estimated: edge.estimated,
				})!,
				bounds?.lower ?? null,
				bounds?.upper ?? null,
				edge.complete ? 1 : 0,
			);
		}
		for (const gap of chain.gaps) insertGap.run(id, gap.from, gap.reason);
		summary.chains += 1;
		summary.edges += chain.edges.length;
		summary.gaps += chain.gaps.length;
	};
	for (const [geography, [current, ...older]] of releasesByGeography(
		database,
	)) {
		if (!current) continue;
		for (const old of older) {
			const starts = (
				versionsOf.all(old.id) as Array<{ id: number }>
			).map((row) => row.id);
			const chains = chainsBetween(router, old.id, current.id, starts);
			if (!chains) {
				summary.unrouted.push({ geography, release: old.release });
				continue;
			}
			for (const chain of chains)
				store(geography, old.release, current.release, chain);
		}
	}
	return summary;
};
