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
): SQLInputValue[] => {
	const fields = value as Record<string, SQLInputValue | string[]>;
	for (const key of Object.keys(fields))
		if (!(key in columns))
			throw new Error(`Unknown crosswalk endpoint field ${key}`);
	return [
		JSON.stringify(Object.keys(fields)),
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
	function* headers() {
		for (const [position, entry] of inventory.crosswalks.entries()) {
			const { artifact, bytes } = read(entry);
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
		for (const entry of inventory.crosswalks) {
			const { artifact } = read(entry);
			for (const [position, record] of artifact.records.entries())
				yield [
					entry.id,
					position,
					...endpointValues(record.source, sourceColumns),
				];
		}
	}
	function* targets() {
		for (const entry of inventory.crosswalks) {
			const { artifact } = read(entry);
			for (const [sourcePosition, record] of artifact.records.entries())
				for (const [position, target] of record.targets.entries())
					yield [
						entry.id,
						sourcePosition,
						position,
						...endpointValues(target, targetColumns),
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
		crosswalk_sources: {
			columns: [
				"crosswalkId TEXT NOT NULL REFERENCES crosswalks(id)",
				"position INTEGER NOT NULL",
				"fields TEXT NOT NULL",
				...Object.entries(sourceColumns).map(
					([key, type]) =>
						`"${key}" ${type}${key === "code" || key === "labels" ? " NOT NULL" : ""}`,
				),
			],
			key: ["crosswalkId", "position"],
			rows: sources(),
			indexes: [["crosswalkId", "code"]],
		},
		crosswalk_targets: {
			columns: [
				"crosswalkId TEXT NOT NULL",
				"sourcePosition INTEGER NOT NULL",
				"position INTEGER NOT NULL",
				"fields TEXT NOT NULL",
				...Object.entries(targetColumns).map(
					([key, type]) =>
						`"${key}" ${type}${key === "code" || key === "labels" ? " NOT NULL" : ""}`,
				),
			],
			key: ["crosswalkId", "sourcePosition", "position"],
			rows: targets(),
			constraints: [
				"FOREIGN KEY (crosswalkId, sourcePosition) REFERENCES crosswalk_sources(crosswalkId, position)",
			],
			indexes: [["crosswalkId", "code"]],
		},
	};
};

export const readSqliteCrosswalkInventory = (
	apiRoot: string,
): CrosswalkInventory => {
	const database = new DatabaseSync(
		resolve(apiRoot, "../../compiled/atlas.sqlite"),
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
		resolve(apiRoot, "../../compiled/atlas.sqlite"),
		{ readOnly: true },
	);
	try {
		const row = database
			.prepare(
				"SELECT header, contentHash, bytes FROM crosswalks WHERE id = ?",
			)
			.get(expected.id);
		if (!row || row.contentHash !== expected.contentHash)
			throw new Error(`Invalid crosswalk artifact ${expected.id}`);
		const targets = new Map<number, object[]>();
		for (const target of database
			.prepare(
				"SELECT * FROM crosswalk_targets WHERE crosswalkId = ? ORDER BY sourcePosition, position",
			)
			.iterate(expected.id)) {
			const position = target.sourcePosition as number;
			let list = targets.get(position);
			if (!list) targets.set(position, (list = []));
			list.push(endpoint(target));
		}
		const records = database
			.prepare(
				"SELECT * FROM crosswalk_sources WHERE crosswalkId = ? ORDER BY position",
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
