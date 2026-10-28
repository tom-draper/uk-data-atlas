import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	DatabaseSync,
	type SQLInputValue,
	type SQLOutputValue,
} from "node:sqlite";
import type { CrosswalkArtifact } from "@uk-data-atlas/relationships";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import type { SqliteTable } from "./sqliteIndex";
import { readStoredText } from "@uk-data-atlas/artifacts";
import { atlasDatabasePath } from "./dataLayout";
import { addAreaVersion } from "./atlasAreas";

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

type Endpoint = Record<string, unknown> & { code: string; labels: string[] };
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

const WEIGHT_BASES: Record<string, string> = {
	area: "Area of overlap, in square metres",
	population: "Residents in the overlap",
};

/**
 * One crosswalk side's field order: every key in the order endpoints give
 * them. An endpoint must list its keys in this order, leaving out the ones it
 * does not have.
 */
const mergeFields = (fields: string[], keys: string[]) => {
	let previous = -1;
	for (const key of keys) {
		const index = fields.indexOf(key);
		if (index === -1) fields.splice((previous += 1), 0, key);
		else previous = index;
	}
};

const checkFields = (fields: string[], keys: string[], id: string) => {
	let previous = -1;
	for (const key of keys) {
		const index = fields.indexOf(key);
		if (index <= previous)
			throw new Error(
				`Crosswalk ${id} lists endpoint fields out of order`,
			);
		previous = index;
	}
};

const canonicalLabels = (name: SQLOutputValue, aliases: SQLOutputValue) =>
	JSON.stringify([name, ...JSON.parse((aliases as string | null) ?? "[]")]);

/** Find or add an endpoint's area version, recording source area facts. */
const areaEndpoints = (database: DatabaseSync) => {
	const find = database.prepare(
		"SELECT v.id, v.name, v.aliases, v.area_m2 AS areaM2, v.population FROM area a JOIN area_version v ON v.area_id = a.id WHERE a.code = ? AND a.geography_id = (SELECT g.id FROM area_releases r JOIN geography g ON g.slug = r.geography WHERE r.position = ?) AND v.release_id = ?",
	);
	const add = addAreaVersion(database);
	const updateFacts = database.prepare(
		"UPDATE area_version SET area_m2 = coalesce(area_m2, ?), population = coalesce(population, ?) WHERE id = ?",
	);
	return (value: Endpoint, release: number, isSource: boolean) => {
		if (
			typeof value.code !== "string" ||
			!Array.isArray(value.labels) ||
			value.labels.some((label) => typeof label !== "string")
		)
			throw new Error(`Invalid crosswalk area ${release}/${value.code}`);
		let area = find.get(value.code, release, release);
		if (!area) {
			add(
				release,
				value.code,
				value.labels[0] ?? "",
				JSON.stringify(value.labels.slice(1)),
			);
			area = find.get(value.code, release, release)!;
		}
		if (isSource) {
			for (const key of ["areaM2", "population"] as const) {
				const fact = value[key];
				if (
					fact !== undefined &&
					(typeof fact !== "number" ||
						!Number.isFinite(fact) ||
						(area[key] !== null && area[key] !== fact))
				)
					throw new Error(
						`Conflicting crosswalk area fact ${release}/${value.code}/${key}`,
					);
			}
			if (value.areaM2 !== undefined || value.population !== undefined)
				updateFacts.run(
					(value.areaM2 as number | undefined) ?? null,
					(value.population as number | undefined) ?? null,
					area.id as number,
				);
		}
		const labels = JSON.stringify(value.labels);
		return {
			id: Number(area.id),
			labels:
				labels === canonicalLabels(area.name, area.aliases)
					? null
					: labels,
		};
	};
};

export const crosswalkTables = (
	directory: string,
): Record<string, SqliteTable> => {
	const inventory: CrosswalkInventory = JSON.parse(
		readFileSync(join(directory, "crosswalk-inventory.json"), "utf8"),
	);
	const read = (entry: CrosswalkInventory["crosswalks"][number]) => {
		const text = readStoredText(join(directory, entry.artifact));
		const artifact: CrosswalkArtifact = JSON.parse(text);
		if (
			artifact.schemaVersion !== 1 ||
			artifact.contentHash !== entry.contentHash ||
			artifact.records.length !== entry.recordCount
		)
			throw new Error(`Invalid crosswalk artifact ${entry.id}`);
		return { artifact, bytes: Buffer.byteLength(text) };
	};
	const basisOf = (entry: CrosswalkInventory["crosswalks"][number]) => {
		const weighting = entry.weighting as { status: string; basis?: string };
		if (weighting.status !== "provided") return null;
		if (!weighting.basis || !(weighting.basis in WEIGHT_BASES))
			throw new Error(
				`Crosswalk ${entry.id} has unknown weight basis ${weighting.basis}`,
			);
		return weighting.basis;
	};
	const fields: { source: string[]; target: string[] }[] = [];
	function* headers(database: DatabaseSync) {
		const release = database.prepare(
			"SELECT position FROM area_releases WHERE geography = ? AND id = ?",
		);
		const position = (side: {
			geography: string;
			boundaryRelease: string;
		}) => {
			const row = release.get(side.geography, side.boundaryRelease);
			if (!row)
				throw new Error(
					`Missing crosswalk area release ${side.geography}/${side.boundaryRelease}`,
				);
			return Number(row.position);
		};
		for (const [id, entry] of inventory.crosswalks.entries()) {
			const { artifact, bytes } = read(entry);
			// Source facts live on the area version, shared by every crosswalk,
			// so a crosswalk's sources must all give the same fields.
			const source = Object.keys(artifact.records[0]?.source ?? {});
			const target: string[] = [];
			for (const record of artifact.records) {
				if (
					JSON.stringify(Object.keys(record.source)) !==
					JSON.stringify(source)
				)
					throw new Error(
						`Crosswalk ${entry.id} sources do not all give the same fields`,
					);
				for (const value of record.targets)
					mergeFields(target, Object.keys(value));
			}
			fields.push({ source, target });
			const header = Object.fromEntries(
				Object.entries(artifact).map(([key, value]) => [
					key,
					key === "records" ? null : value,
				]),
			);
			yield [
				id,
				entry.id,
				position(entry.from),
				position(entry.to),
				entry.method,
				entry.quality,
				entry.relationshipPurpose ?? null,
				JSON.stringify(entry.weighting),
				basisOf(entry),
				entry.recordCount,
				entry.artifact,
				entry.contentHash,
				JSON.stringify(header),
				bytes,
				JSON.stringify(source),
				JSON.stringify(target),
			];
		}
	}
	/**
	 * Every endpoint row, written in one pass over each artifact. Yields the
	 * sparse source rows; edges, weights, checks and labels are inserted as
	 * they are read.
	 */
	function* sources(database: DatabaseSync) {
		const endpoint = areaEndpoints(database);
		const insert = (table: string, count: number) =>
			database.prepare(
				`INSERT INTO ${table} VALUES (${Array.from({ length: count }, () => "?").join(", ")})`,
			);
		const addEdge = insert("crosswalk_edge", 3 + EDGE_COLUMNS.length);
		const addWeight = insert("crosswalk_weight", 4 + WEIGHT_COLUMNS.length);
		const addCheck = insert(
			"crosswalk_edge_check",
			3 + CHECK_COLUMNS.length,
		);
		const findLabels = database.prepare(
			"SELECT labels FROM crosswalk_label WHERE crosswalk_id = ? AND area_version_id = ?",
		);
		const addLabels = insert("crosswalk_label", 3);
		const label = (
			crosswalk: number,
			id: number,
			labels: string | null,
		) => {
			if (labels === null) return;
			const existing = findLabels.get(crosswalk, id);
			if (!existing) addLabels.run(crosswalk, id, labels);
			else if (existing.labels !== labels)
				throw new Error(
					`Crosswalk ${crosswalk} gives area version ${id} two sets of labels`,
				);
		};
		const releases = database.prepare(
			"SELECT from_release_id AS source, to_release_id AS target, basis_id AS basis FROM crosswalk WHERE id = ?",
		);
		for (const [crosswalk, entry] of inventory.crosswalks.entries()) {
			const { artifact } = read(entry);
			const { source, target, basis } = releases.get(crosswalk) as {
				source: number;
				target: number;
				basis: string | null;
			};
			const order = fields[crosswalk]!;
			let previousSource: string | undefined;
			for (const record of artifact.records) {
				const value = record.source as Endpoint;
				if (
					previousSource !== undefined &&
					!(previousSource < value.code)
				)
					throw new Error(
						`Crosswalk ${entry.id} records are not in source code order`,
					);
				previousSource = value.code;
				checkFields(order.source, Object.keys(value), entry.id);
				for (const key of Object.keys(value))
					if (
						key !== "code" &&
						key !== "labels" &&
						!(key in SOURCE_FIELDS)
					)
						throw new Error(
							`Unknown crosswalk endpoint field ${key}`,
						);
				const from = endpoint(value, source, true);
				label(crosswalk, from.id, from.labels);
				const coverage = value.coverage as number | undefined;
				if (coverage !== undefined || record.targets.length === 0)
					yield [crosswalk, from.id, coverage ?? null];
				let previousTarget: string | undefined;
				for (const raw of record.targets) {
					const value = raw as Endpoint;
					if (
						previousTarget !== undefined &&
						!(previousTarget < value.code)
					)
						throw new Error(
							`Crosswalk ${entry.id} targets of ${previousSource} are not in code order`,
						);
					previousTarget = value.code;
					checkFields(order.target, Object.keys(value), entry.id);
					const columns: Record<string, SQLInputValue> = {};
					for (const [key, field] of Object.entries(value)) {
						if (key === "code" || key === "labels") continue;
						const column = targetColumn(key, basis);
						if (!column)
							throw new Error(
								`Unknown crosswalk endpoint field ${key}`,
							);
						if (field === null)
							throw new Error(
								`Crosswalk ${entry.id} has a null ${key}, which cannot be told from a missing one`,
							);
						columns[column] = field as SQLInputValue;
					}
					const to = endpoint(value, target, false);
					label(crosswalk, to.id, to.labels);
					const key = [crosswalk, from.id, to.id];
					addEdge.run(
						...key,
						...EDGE_COLUMNS.map(
							(column) => columns[column] ?? null,
						),
					);
					if (basis !== null) {
						if (columns.weight === undefined)
							throw new Error(
								`Crosswalk ${entry.id} has a target without a weight`,
							);
						addWeight.run(
							...key,
							basis,
							...WEIGHT_COLUMNS.map(
								(column) => columns[column] ?? null,
							),
						);
					}
					if (CHECK_COLUMNS.some((column) => column in columns))
						addCheck.run(
							...key,
							...CHECK_COLUMNS.map(
								(column) => columns[column] ?? null,
							),
						);
				}
			}
		}
	}
	const edgeKey = [
		"crosswalk_id INTEGER NOT NULL REFERENCES crosswalk(id)",
		"from_version_id INTEGER NOT NULL REFERENCES area_version(id)",
		"to_version_id INTEGER NOT NULL REFERENCES area_version(id)",
	];
	const edgeReference =
		"FOREIGN KEY (crosswalk_id, from_version_id, to_version_id) REFERENCES crosswalk_edge (crosswalk_id, from_version_id, to_version_id)";
	return {
		crosswalk_inventory: {
			columns: [
				"schemaVersion INTEGER NOT NULL",
				"contentHash TEXT NOT NULL",
				"areaInventoryHash TEXT",
			],
			rows: [
				[
					inventory.schemaVersion,
					inventory.contentHash,
					inventory.releaseCoverage?.areaInventoryHash ?? null,
				],
			],
		},
		crosswalk_coverage: {
			columns: [
				"geography TEXT NOT NULL",
				"boundaryRelease TEXT NOT NULL",
				"position INTEGER NOT NULL UNIQUE",
				"areaCount INTEGER NOT NULL",
				"relatedAreaCount INTEGER NOT NULL",
			],
			key: ["geography", "boundaryRelease"],
			rows: (inventory.releaseCoverage?.releases ?? []).map(
				(row, position) => [
					row.geography,
					row.boundaryRelease,
					position,
					row.areaCount,
					row.relatedAreaCount,
				],
			),
		},
		weight_basis: {
			strict: true,
			columns: ["id TEXT NOT NULL", "label TEXT NOT NULL"],
			key: ["id"],
			rows: Object.entries(WEIGHT_BASES),
		},
		crosswalk: {
			rowid: true,
			strict: true,
			columns: [
				"id INTEGER",
				"slug TEXT NOT NULL UNIQUE",
				"from_release_id INTEGER NOT NULL REFERENCES area_releases(position)",
				"to_release_id INTEGER NOT NULL REFERENCES area_releases(position)",
				"method TEXT NOT NULL",
				"quality TEXT NOT NULL",
				"purpose TEXT CHECK (purpose IN ('identity', 'membership'))",
				"weighting TEXT NOT NULL",
				"basis_id TEXT REFERENCES weight_basis(id)",
				"record_count INTEGER NOT NULL",
				"artifact TEXT NOT NULL",
				"content_hash TEXT NOT NULL",
				"header TEXT NOT NULL",
				"bytes INTEGER NOT NULL",
				"source_fields TEXT NOT NULL",
				"target_fields TEXT NOT NULL",
			],
			key: ["id"],
			rows: headers,
			indexes: [
				{
					name: "crosswalk_releases",
					columns: ["from_release_id", "to_release_id"],
				},
			],
		},
		crosswalk_edge: {
			strict: true,
			columns: [
				...edgeKey,
				"relation TEXT CHECK (relation IN ('within', 'straddles', 'indeterminate'))",
				"change TEXT CHECK (change IN ('unchanged', 'split', 'merged', 'complex'))",
			],
			key: ["crosswalk_id", "from_version_id", "to_version_id"],
			rows: [],
			indexes: [
				{
					name: "crosswalk_edge_to",
					columns: ["crosswalk_id", "to_version_id"],
				},
			],
		},
		crosswalk_weight: {
			strict: true,
			columns: [
				...edgeKey,
				"basis_id TEXT NOT NULL REFERENCES weight_basis(id)",
				"weight REAL NOT NULL",
				"overlap REAL",
				"source_share REAL",
				"target_share REAL",
			],
			key: [
				"crosswalk_id",
				"from_version_id",
				"to_version_id",
				"basis_id",
			],
			constraints: [edgeReference],
			rows: [],
		},
		crosswalk_edge_check: {
			strict: true,
			columns: [
				...edgeKey,
				"contained_share REAL",
				"outside_width_m REAL",
				"match TEXT CHECK (match IN ('same-code', 'recoded'))",
				"widest_difference_m REAL",
				"claimed_difference_m REAL",
				"check_source_share REAL",
				"check_target_share REAL",
				"overlap_area_m2 REAL",
			],
			key: ["crosswalk_id", "from_version_id", "to_version_id"],
			constraints: [edgeReference],
			rows: [],
		},
		crosswalk_label: {
			strict: true,
			columns: [
				"crosswalk_id INTEGER NOT NULL REFERENCES crosswalk(id)",
				"area_version_id INTEGER NOT NULL REFERENCES area_version(id)",
				"labels TEXT NOT NULL",
			],
			key: ["crosswalk_id", "area_version_id"],
			rows: [],
		},
		crosswalk_source: {
			strict: true,
			columns: [
				"crosswalk_id INTEGER NOT NULL REFERENCES crosswalk(id)",
				"from_version_id INTEGER NOT NULL REFERENCES area_version(id)",
				"coverage REAL",
			],
			key: ["crosswalk_id", "from_version_id"],
			rows: sources,
			views: {
				v_crosswalk_edge: `SELECT c.slug AS crosswalk, fa.code AS from_code, fv.name AS from_name, ta.code AS to_code, tv.name AS to_name, e.relation, e.change, w.basis_id AS basis, w.weight, w.overlap, w.source_share, w.target_share
FROM crosswalk_edge e
JOIN crosswalk c ON c.id = e.crosswalk_id
JOIN area_version fv ON fv.id = e.from_version_id
JOIN area fa ON fa.id = fv.area_id
JOIN area_version tv ON tv.id = e.to_version_id
JOIN area ta ON ta.id = tv.area_id
LEFT JOIN crosswalk_weight w ON w.crosswalk_id = e.crosswalk_id AND w.from_version_id = e.from_version_id AND w.to_version_id = e.to_version_id`,
			},
		},
	};
};

export const readSqliteCrosswalkInventory = (
	apiRoot: string,
): CrosswalkInventory => {
	const database = new DatabaseSync(atlasDatabasePath(apiRoot), {
		readOnly: true,
	});
	try {
		const header = database
			.prepare("SELECT * FROM crosswalk_inventory")
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
									"SELECT geography, boundaryRelease, areaCount, relatedAreaCount FROM crosswalk_coverage ORDER BY position",
								)
								.all(),
						},
					}),
		} as CrosswalkInventory;
	} finally {
		database.close();
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
	apiRoot: string,
	expected: CrosswalkInventory["crosswalks"][number],
) => {
	const database = new DatabaseSync(atlasDatabasePath(apiRoot), {
		readOnly: true,
	});
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
		database.close();
	}
};
