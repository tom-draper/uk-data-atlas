import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	DatabaseSync,
	type SQLInputValue,
	type SQLOutputValue,
} from "node:sqlite";
import type { CrosswalkArtifact } from "./crosswalkTypes";
import type { CrosswalkInventory } from "./crosswalkInventory";
import type { SqliteTable } from "./sqliteIndex";
import { readStoredText } from "./storedText";
import { atlasDatabasePath } from "./dataLayout";

const sourceColumns = {
	code: "TEXT",
	labels: "TEXT",
	areaM2: "REAL",
	coverage: "REAL",
	population: "REAL",
};
const targetColumns = {
	code: "TEXT",
	labels: "TEXT",
	change: "TEXT",
	weight: "REAL",
	overlapAreaM2: "REAL",
	sourceShare: "REAL",
	targetShare: "REAL",
	population: "REAL",
	containedShare: "REAL",
	outsideWidthM: "REAL",
	match: "TEXT",
	widestDifferenceM: "REAL",
	claimedDifferenceM: "REAL",
	relation: "TEXT",
};
const endpointValues = (
	value: object,
	columns: Record<string, string>,
	fieldSets: Map<string, number>,
): SQLInputValue[] => {
	const fields = value as Record<string, SQLInputValue | string[]>;
	for (const key of Object.keys(fields))
		if (!(key in columns))
			throw new Error(`Unknown crosswalk endpoint field ${key}`);
	return [
		fieldSets.get(JSON.stringify(Object.keys(fields))) ?? null,
		...Object.keys(columns).map((key) =>
			key === "labels"
				? JSON.stringify(fields[key])
				: ((fields[key] as SQLInputValue) ?? null),
		),
	];
};
const areaLabelsSql = `CASE WHEN a.aliases IS NULL OR a.aliases = '[]' THEN json_array(a.name) ELSE substr(json_array(a.name), 1, length(json_array(a.name)) - 1) || ',' || substr(a.aliases, 2) END`;
const decodedColumn = (key: string, alias: string) =>
	key === "code"
		? "a.code"
		: key === "labels"
			? `coalesce(l.labels, ${areaLabelsSql}) AS labels`
			: alias === "s" && (key === "areaM2" || key === "population")
				? `a."${key}"`
				: `${alias}."${key}"`;

const areaEndpointValues = (
	database: DatabaseSync,
	fieldSets: Map<string, number>,
) => {
	const find = database.prepare(
		"SELECT a.id, a.name, a.aliases, a.areaM2, a.population FROM areas a JOIN area_releases r ON r.position = a.releasePosition WHERE r.geography = ? AND r.id = ? AND a.code = ?",
	);
	const releasePosition = database.prepare(
		"SELECT position FROM area_releases WHERE geography = ? AND id = ?",
	);
	const add = database.prepare(
		"INSERT INTO areas (releasePosition, code, inInventory, name, aliases) VALUES ((SELECT position FROM area_releases WHERE geography = ? AND id = ?), ?, 0, ?, ?)",
	);
	const updateFacts = database.prepare(
		"UPDATE areas SET areaM2 = coalesce(areaM2, ?), population = coalesce(population, ?) WHERE id = ?",
	);
	const findLabels = database.prepare(
		"SELECT position FROM crosswalk_label_exceptions WHERE labels = ?",
	);
	const addLabels = database.prepare(
		"INSERT INTO crosswalk_label_exceptions (labels) VALUES (?)",
	);
	return (
		value: {
			code: string;
			labels: string[];
			areaM2?: number;
			population?: number;
		},
		columns: Record<string, string>,
		geography: string,
		release: string,
	): SQLInputValue[] => {
		if (
			typeof value.code !== "string" ||
			!Array.isArray(value.labels) ||
			value.labels.some((label) => typeof label !== "string")
		)
			throw new Error(
				`Invalid crosswalk area ${geography}/${release}/${value.code}`,
			);
		let area = find.get(geography, release, value.code);
		if (!area) {
			if (!releasePosition.get(geography, release))
				throw new Error(
					`Missing crosswalk area release ${geography}/${release}`,
				);
			add.run(
				geography,
				release,
				value.code,
				value.labels[0] ?? "",
				JSON.stringify(value.labels.slice(1)),
			);
			area = find.get(geography, release, value.code)!;
		}
		if (columns === sourceColumns) {
			for (const key of ["areaM2", "population"] as const) {
				const fact = value[key];
				if (
					fact !== undefined &&
					(!Number.isFinite(fact) ||
						(area[key] !== null && area[key] !== fact))
				)
					throw new Error(
						`Conflicting crosswalk area fact ${geography}/${release}/${value.code}/${key}`,
					);
			}
			if (value.areaM2 !== undefined || value.population !== undefined)
				updateFacts.run(
					value.areaM2 ?? null,
					value.population ?? null,
					area.id,
				);
		}
		const labels = JSON.stringify(value.labels);
		const canonical = JSON.stringify([
			area.name,
			...JSON.parse((area.aliases as string) ?? "[]"),
		]);
		let labelsId: SQLInputValue = null;
		if (labels !== canonical) {
			let row = findLabels.get(labels);
			if (!row) {
				addLabels.run(labels);
				row = findLabels.get(labels)!;
			}
			labelsId = row.position;
		}
		const keys = Object.keys(columns);
		const [fields, ...values] = endpointValues(value, columns, fieldSets);
		return [
			fields,
			area.id,
			labelsId,
			...values.filter((_, index) => {
				const key = keys[index];
				return (
					key !== "code" &&
					key !== "labels" &&
					!(
						columns === sourceColumns &&
						(key === "areaM2" || key === "population")
					)
				);
			}),
		];
	};
};

const endpoint = (row: Record<string, SQLOutputValue>) =>
	Object.fromEntries(
		(JSON.parse(row.fields as string) as string[]).map((key) => [
			key,
			key === "labels" ? JSON.parse(row[key] as string) : row[key],
		]),
	);

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
	const fieldSets = new Map<string, number>();
	function* headers() {
		for (const [position, entry] of inventory.crosswalks.entries()) {
			const { artifact, bytes } = read(entry);
			for (const record of artifact.records)
				for (const value of [record.source, ...record.targets]) {
					const fields = JSON.stringify(Object.keys(value));
					if (!fieldSets.has(fields))
						fieldSets.set(fields, fieldSets.size);
				}
			const header = Object.fromEntries(
				Object.entries(artifact).map(([key, value]) => [
					key,
					key === "records" ? null : value,
				]),
			);
			yield [
				entry.id,
				position,
				entry.from.geography,
				entry.from.boundaryRelease,
				entry.to.geography,
				entry.to.boundaryRelease,
				entry.method,
				entry.quality,
				entry.relationshipPurpose ?? null,
				JSON.stringify(entry.weighting),
				entry.recordCount,
				entry.artifact,
				entry.contentHash,
				JSON.stringify(header),
				bytes,
			];
		}
	}
	function* sources(database: DatabaseSync) {
		const values = areaEndpointValues(database, fieldSets);
		for (const [
			crosswalkPosition,
			entry,
		] of inventory.crosswalks.entries()) {
			const { artifact } = read(entry);
			for (const [position, record] of artifact.records.entries())
				yield [
					crosswalkPosition,
					position,
					...values(
						record.source,
						sourceColumns,
						entry.from.geography,
						entry.from.boundaryRelease,
					),
				];
		}
	}
	function* targets(database: DatabaseSync) {
		const values = areaEndpointValues(database, fieldSets);
		for (const [
			crosswalkPosition,
			entry,
		] of inventory.crosswalks.entries()) {
			const { artifact } = read(entry);
			for (const [sourcePosition, record] of artifact.records.entries())
				for (const [position, target] of record.targets.entries())
					yield [
						crosswalkPosition,
						sourcePosition,
						position,
						...values(
							target,
							targetColumns,
							entry.to.geography,
							entry.to.boundaryRelease,
						),
					];
		}
	}
	return {
		crosswalk_label_exceptions: {
			columns: ["labels TEXT NOT NULL UNIQUE"],
			rows: [],
		},
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
		crosswalks: {
			columns: [
				"id TEXT NOT NULL",
				"position INTEGER NOT NULL UNIQUE",
				"fromGeography TEXT NOT NULL",
				"fromRelease TEXT NOT NULL",
				"toGeography TEXT NOT NULL",
				"toRelease TEXT NOT NULL",
				"method TEXT NOT NULL",
				"quality TEXT NOT NULL",
				"relationshipPurpose TEXT",
				"weighting TEXT NOT NULL",
				"recordCount INTEGER NOT NULL",
				"artifact TEXT NOT NULL",
				"contentHash TEXT NOT NULL",
				"header TEXT NOT NULL",
				"bytes INTEGER NOT NULL",
			],
			key: ["id"],
			rows: headers(),
			indexes: [
				["fromGeography", "fromRelease", "toGeography", "toRelease"],
			],
		},
		crosswalk_field_sets: {
			columns: ["fields TEXT NOT NULL UNIQUE"],
			rows: (function* () {
				for (const fields of fieldSets.keys()) yield [fields];
			})(),
		},
		crosswalk_sources: {
			columns: [
				"crosswalkPosition INTEGER NOT NULL REFERENCES crosswalks(position)",
				"position INTEGER NOT NULL",
				"fieldSetId INTEGER NOT NULL REFERENCES crosswalk_field_sets(position)",
				"areaId INTEGER NOT NULL REFERENCES areas(id)",
				"labelsId INTEGER REFERENCES crosswalk_label_exceptions(position)",
				...Object.entries(sourceColumns)
					.filter(
						([key]) =>
							key !== "code" &&
							key !== "labels" &&
							key !== "areaM2" &&
							key !== "population",
					)
					.map(([key, type]) => `"${key}" ${type}`),
			],
			key: ["crosswalkPosition", "position"],
			rows: sources,
			indexes: [["crosswalkPosition", "areaId"]],
			views: {
				crosswalk_sources_decoded: `SELECT c.id AS crosswalkId, s.position, f.fields, ${Object.keys(
					sourceColumns,
				)
					.map((key) => decodedColumn(key, "s"))
					.join(
						", ",
					)} FROM crosswalk_sources s JOIN crosswalks c ON c.position = s.crosswalkPosition JOIN crosswalk_field_sets f ON f.position = s.fieldSetId JOIN areas a ON a.id = s.areaId LEFT JOIN crosswalk_label_exceptions l ON l.position = s.labelsId`,
			},
		},
		crosswalk_targets: {
			columns: [
				"crosswalkPosition INTEGER NOT NULL",
				"sourcePosition INTEGER NOT NULL",
				"position INTEGER NOT NULL",
				"fieldSetId INTEGER NOT NULL REFERENCES crosswalk_field_sets(position)",
				"areaId INTEGER NOT NULL REFERENCES areas(id)",
				"labelsId INTEGER REFERENCES crosswalk_label_exceptions(position)",
				...Object.entries(targetColumns)
					.filter(([key]) => key !== "code" && key !== "labels")
					.map(([key, type]) => `"${key}" ${type}`),
			],
			key: ["crosswalkPosition", "sourcePosition", "position"],
			rows: targets,
			constraints: [
				"FOREIGN KEY (crosswalkPosition, sourcePosition) REFERENCES crosswalk_sources(crosswalkPosition, position)",
			],
			indexes: [["crosswalkPosition", "areaId"]],
			views: {
				crosswalk_targets_decoded: `SELECT c.id AS crosswalkId, t.sourcePosition, t.position, f.fields, ${Object.keys(
					targetColumns,
				)
					.map((key) => decodedColumn(key, "t"))
					.join(
						", ",
					)} FROM crosswalk_targets t JOIN crosswalks c ON c.position = t.crosswalkPosition JOIN crosswalk_field_sets f ON f.position = t.fieldSetId JOIN areas a ON a.id = t.areaId LEFT JOIN crosswalk_label_exceptions l ON l.position = t.labelsId`,
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
			.prepare("SELECT * FROM crosswalks ORDER BY position")
			.all()
			.map((row) => ({
				id: row.id,
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
				...(row.relationshipPurpose === null
					? {}
					: { relationshipPurpose: row.relationshipPurpose }),
				weighting: JSON.parse(row.weighting as string),
				recordCount: row.recordCount,
				artifact: row.artifact,
				contentHash: row.contentHash,
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
				"SELECT position, header, contentHash, bytes FROM crosswalks WHERE id = ?",
			)
			.get(expected.id);
		if (!row || row.contentHash !== expected.contentHash)
			throw new Error(`Invalid crosswalk artifact ${expected.id}`);
		const targets = new Map<number, object[]>();
		for (const target of database
			.prepare(
				"SELECT * FROM crosswalk_targets_decoded WHERE crosswalkId = ? ORDER BY sourcePosition, position",
			)
			.iterate(expected.id)) {
			const position = target.sourcePosition as number;
			let list = targets.get(position);
			if (!list) targets.set(position, (list = []));
			list.push(endpoint(target));
		}
		const records = database
			.prepare(
				"SELECT * FROM crosswalk_sources_decoded WHERE crosswalkId = ? ORDER BY position",
			)
			.all(expected.id)
			.map((source) => ({
				source: endpoint(source),
				targets: targets.get(source.position as number) ?? [],
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
