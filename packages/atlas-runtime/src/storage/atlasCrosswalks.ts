import { type SQLOutputValue } from "node:sqlite";
import type { CrosswalkArtifact } from "@uk-data-atlas/relationships";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import { atlasDatabasePath } from "./dataLayout.ts";
import { openReadOnlyDatabase } from "./readOnlyDatabase.ts";

/**
 * Crosswalks as integer edges between area versions (layer 3 of
 * docs/sqlite-schema-design.md). An edge relates a source area version to a
 * target area version. Weights are rows by basis, matching diagnostics are a
 * sparse check table, and publisher labels are stored only where they differ
 * from the area's name and aliases.
 *
 * Order is not stored: records are in source code order and targets in target
 * code order, and the build refuses input that is not. Each crosswalk keeps
 * the order of its endpoint fields, so artifacts rebuild byte for byte.
 */

type Values = Record<string, SQLOutputValue>;

/** Source fields beyond `code` and `labels`, and the column holding each. */
const SOURCE_FIELDS: Record<string, string> = {
	areaM2: "area_m2",
	population: "population",
	coverage: "coverage",
};

/** Target fields with the same place whatever the crosswalk's weighting. */
const EDGE_FIELDS: Record<string, string> = {
	relation: "relation",
	change: "change",
	containedShare: "contained_share",
	outsideWidthM: "outside_width_m",
	match: "match",
	widestDifferenceM: "widest_difference_m",
	claimedDifferenceM: "claimed_difference_m",
};

/** Where a target field is stored, given the crosswalk's weight basis. */
const targetColumn = (key: string, basis: string | null) => {
	if (key in EDGE_FIELDS) return EDGE_FIELDS[key]!;
	if (basis !== null) {
		if (key === "weight") return "weight";
		if (key === "sourceShare") return "source_share";
		if (key === "targetShare") return "target_share";
		if (key === (basis === "area" ? "overlapAreaM2" : "population"))
			return "overlap";
	}
	if (key === "sourceShare") return "check_source_share";
	if (key === "targetShare") return "check_target_share";
	if (key === "overlapAreaM2") return "overlap_area_m2";
	return undefined;
};

const EDGE_COLUMNS = ["relation", "change"];
const CHECK_COLUMNS = [
	"contained_share",
	"outside_width_m",
	"match",
	"widest_difference_m",
	"claimed_difference_m",
	"check_source_share",
	"check_target_share",
	"overlap_area_m2",
];
const WEIGHT_COLUMNS = ["weight", "overlap", "source_share", "target_share"];

const canonicalLabels = (name: SQLOutputValue, aliases: SQLOutputValue) =>
	JSON.stringify([name, ...JSON.parse((aliases as string | null) ?? "[]")]);

export const readSqliteCrosswalkInventory = (
	repositoryRoot: string,
	databasePath = atlasDatabasePath(repositoryRoot),
): CrosswalkInventory => {
	const database = openReadOnlyDatabase(databasePath);
	try {
		const header = database
			.prepare("SELECT schema_version AS schemaVersion, content_hash AS contentHash, area_inventory_hash AS areaInventoryHash FROM crosswalk_inventory_metadata")
			.get();
		if (!header || header.schemaVersion !== 1)
			throw new Error("Invalid SQLite crosswalk inventory");
		const crosswalks = database
			.prepare(
				"SELECT c.*, f.geography AS fromGeography, f.id AS fromRelease, t.geography AS toGeography, t.id AS toRelease FROM crosswalk c JOIN area_releases f ON f.position = c.from_release_id JOIN area_releases t ON t.position = c.to_release_id ORDER BY c.id",
			)
			.all()
			.map((row) => ({
				id: row.slug,
				from: {
					geography: row.fromGeography,
					boundaryRelease: row.fromRelease,
				},
				to: {
					geography: row.toGeography,
					boundaryRelease: row.toRelease,
				},
				method: row.method,
				quality: row.quality,
				...(row.purpose === null
					? {}
					: { relationshipPurpose: row.purpose }),
				weighting: JSON.parse(row.weighting as string),
				recordCount: row.record_count,
				artifact: row.artifact,
				contentHash: row.content_hash,
			}));
		return {
			schemaVersion: 1,
			contentHash: header.contentHash,
			crosswalks,
			...(header.areaInventoryHash === null
				? {}
				: {
						releaseCoverage: {
							areaInventoryHash: header.areaInventoryHash,
							releases: database
								.prepare(
									"SELECT geography, boundary_release AS boundaryRelease, area_count AS areaCount, related_area_count AS relatedAreaCount FROM crosswalk_coverage_entry ORDER BY position",
								)
								.all(),
						},
					}),
		} as CrosswalkInventory;
	} finally {
		database.release();
	}
};

/** An endpoint in its crosswalk's field order, leaving out absent fields. */
const endpointOf = (
	order: string[],
	row: Values,
	column: (key: string) => string | undefined,
) => {
	const value: Record<string, unknown> = {};
	for (const key of order) {
		if (key === "code") value.code = row.code;
		else if (key === "labels")
			value.labels = JSON.parse(
				(row.labels as string | null) ??
					canonicalLabels(row.name, row.aliases),
			);
		else {
			const field = row[column(key)!];
			if (field !== null && field !== undefined) value[key] = field;
		}
	}
	return value;
};

export const readSqliteCrosswalk = (
	repositoryRoot: string,
	expected: CrosswalkInventory["crosswalks"][number],
	databasePath = atlasDatabasePath(repositoryRoot),
) => {
	const database = openReadOnlyDatabase(databasePath);
	try {
		const row = database
			.prepare(
				"SELECT id, header, content_hash, bytes, basis_id, source_fields, target_fields FROM crosswalk WHERE slug = ?",
			)
			.get(expected.id);
		if (!row || row.content_hash !== expected.contentHash)
			throw new Error(`Invalid crosswalk artifact ${expected.id}`);
		const id = row.id as number;
		const basis = row.basis_id as string | null;
		const sourceOrder: string[] = JSON.parse(row.source_fields as string);
		const targetOrder: string[] = JSON.parse(row.target_fields as string);
		const targets = new Map<number, object[]>();
		for (const target of database
			.prepare(
				`SELECT e.from_version_id, a.code, v.name, v.aliases, l.labels, ${[
					...EDGE_COLUMNS.map((column) => `e.${column}`),
					...WEIGHT_COLUMNS.map((column) => `w.${column}`),
					...CHECK_COLUMNS.map((column) => `k.${column}`),
				].join(", ")}
				FROM crosswalk_edge e
				JOIN area_version v ON v.id = e.to_version_id
				JOIN area a ON a.id = v.area_id
				LEFT JOIN crosswalk_label l ON l.crosswalk_id = e.crosswalk_id AND l.area_version_id = e.to_version_id
				LEFT JOIN crosswalk_weight w ON w.crosswalk_id = e.crosswalk_id AND w.from_version_id = e.from_version_id AND w.to_version_id = e.to_version_id
				LEFT JOIN crosswalk_edge_check k ON k.crosswalk_id = e.crosswalk_id AND k.from_version_id = e.from_version_id AND k.to_version_id = e.to_version_id
				WHERE e.crosswalk_id = ?
				ORDER BY e.from_version_id, a.code`,
			)
			.iterate(id)) {
			const from = target.from_version_id as number;
			let list = targets.get(from);
			if (!list) targets.set(from, (list = []));
			list.push(
				endpointOf(targetOrder, target, (key) =>
					targetColumn(key, basis),
				),
			);
		}
		const records = database
			.prepare(
				`SELECT v.id, a.code, v.name, v.aliases, v.area_m2, v.population, s.coverage, l.labels
				FROM (SELECT from_version_id AS id FROM crosswalk_edge WHERE crosswalk_id = ?1
					UNION SELECT from_version_id FROM crosswalk_source WHERE crosswalk_id = ?1) x
				JOIN area_version v ON v.id = x.id
				JOIN area a ON a.id = v.area_id
				LEFT JOIN crosswalk_source s ON s.crosswalk_id = ?1 AND s.from_version_id = v.id
				LEFT JOIN crosswalk_label l ON l.crosswalk_id = ?1 AND l.area_version_id = v.id
				ORDER BY a.code`,
			)
			.all(id)
			.map((source) => ({
				source: endpointOf(
					sourceOrder,
					source,
					(key) => SOURCE_FIELDS[key],
				),
				targets: targets.get(source.id as number) ?? [],
			}));
		if (records.length !== expected.recordCount)
			throw new Error(`Invalid crosswalk artifact ${expected.id}`);
		return {
			artifact: {
				...JSON.parse(row.header as string),
				records,
			} as CrosswalkArtifact,
			bytes: row.bytes as number,
		};
	} finally {
		database.release();
	}
};
