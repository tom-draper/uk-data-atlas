import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	DatabaseSync,
	type SQLInputValue,
	type SQLOutputValue,
} from "node:sqlite";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import type { SqliteTable } from "./sqliteIndex";
import { readStoredText } from "./storedText";

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
	function* sources() {
		for (const [
			crosswalkPosition,
			entry,
		] of inventory.crosswalks.entries()) {
			const { artifact } = read(entry);
			for (const [position, record] of artifact.records.entries())
				yield [
					crosswalkPosition,
					position,
					...endpointValues(record.source, sourceColumns, fieldSets),
				];
		}
	}
	function* targets() {
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
						...endpointValues(target, targetColumns, fieldSets),
					];
		}
	}
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
				...Object.entries(sourceColumns).map(
					([key, type]) =>
						`"${key}" ${type}${key === "code" || key === "labels" ? " NOT NULL" : ""}`,
				),
			],
			key: ["crosswalkPosition", "position"],
			rows: sources(),
			indexes: [["crosswalkPosition", "code"]],
			views: {
				crosswalk_sources_decoded: `SELECT c.id AS crosswalkId, s.position, f.fields, ${Object.keys(
					sourceColumns,
				)
					.map((key) => `s."${key}"`)
					.join(
						", ",
					)} FROM crosswalk_sources s JOIN crosswalks c ON c.position = s.crosswalkPosition JOIN crosswalk_field_sets f ON f.position = s.fieldSetId`,
			},
		},
		crosswalk_targets: {
			columns: [
				"crosswalkPosition INTEGER NOT NULL",
				"sourcePosition INTEGER NOT NULL",
				"position INTEGER NOT NULL",
				"fieldSetId INTEGER NOT NULL REFERENCES crosswalk_field_sets(position)",
				...Object.entries(targetColumns).map(
					([key, type]) =>
						`"${key}" ${type}${key === "code" || key === "labels" ? " NOT NULL" : ""}`,
				),
			],
			key: ["crosswalkPosition", "sourcePosition", "position"],
			rows: targets(),
			constraints: [
				"FOREIGN KEY (crosswalkPosition, sourcePosition) REFERENCES crosswalk_sources(crosswalkPosition, position)",
			],
			indexes: [["crosswalkPosition", "code"]],
			views: {
				crosswalk_targets_decoded: `SELECT c.id AS crosswalkId, t.sourcePosition, t.position, f.fields, ${Object.keys(
					targetColumns,
				)
					.map((key) => `t."${key}"`)
					.join(
						", ",
					)} FROM crosswalk_targets t JOIN crosswalks c ON c.position = t.crosswalkPosition JOIN crosswalk_field_sets f ON f.position = t.fieldSetId`,
			},
		},
	};
};

export const readSqliteCrosswalkInventory = (
	apiRoot: string,
): CrosswalkInventory => {
	const database = new DatabaseSync(
		resolve(apiRoot, "../../data/build/atlas.sqlite"),
		{ readOnly: true },
	);
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
	const database = new DatabaseSync(
		resolve(apiRoot, "../../data/build/atlas.sqlite"),
		{ readOnly: true },
	);
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
				"SELECT t.*, f.fields FROM crosswalk_targets t JOIN crosswalk_field_sets f ON f.position = t.fieldSetId WHERE t.crosswalkPosition = ? ORDER BY t.sourcePosition, t.position",
			)
			.iterate(row.position)) {
			const position = target.sourcePosition as number;
			let list = targets.get(position);
			if (!list) targets.set(position, (list = []));
			list.push(endpoint(target));
		}
		const records = database
			.prepare(
				"SELECT s.*, f.fields FROM crosswalk_sources s JOIN crosswalk_field_sets f ON f.position = s.fieldSetId WHERE s.crosswalkPosition = ? ORDER BY s.position",
			)
			.all(row.position)
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
