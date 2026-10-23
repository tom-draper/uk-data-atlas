import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { lazyValue } from "./lazyValue";
import type { NamedLocation, NamedLocationInventory } from "./namedLocations";
import type { NamedLocationGeometry } from "./namedLocationGeometry";
import type { SqliteTable } from "./sqliteIndex";

export const namedLocationTables = (
	directory: string,
): Record<string, SqliteTable> => {
	const inventory: NamedLocationInventory = JSON.parse(
		readFileSync(join(directory, "named-locations.json"), "utf8"),
	);
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.locations))
		throw new Error("Invalid named location inventory");
	return {
		named_location_inventory: {
			columns: [
				"schemaVersion INTEGER NOT NULL",
				"contentHash TEXT NOT NULL",
				"artifact TEXT NOT NULL",
				"gazetteerVersion INTEGER NOT NULL",
			],
			rows: [
				[
					inventory.schemaVersion,
					inventory.contentHash,
					inventory.source.artifact,
					inventory.source.gazetteerVersion,
				],
			],
		},
		named_locations: {
			columns: [
				"id TEXT NOT NULL",
				"position INTEGER NOT NULL UNIQUE",
				"fields TEXT NOT NULL",
				"label TEXT NOT NULL",
				"kind TEXT NOT NULL",
				"definitionRevision INTEGER NOT NULL",
				"memberGeography TEXT NOT NULL",
				"validFrom TEXT",
				"validTo TEXT",
				"minX REAL NOT NULL",
				"minY REAL NOT NULL",
				"maxX REAL NOT NULL",
				"maxY REAL NOT NULL",
				"source TEXT",
			],
			key: ["id"],
			indexes: [
				["kind", "position"],
				["memberGeography", "position"],
			],
			rows: inventory.locations.map((location, position) => [
				location.id,
				position,
				JSON.stringify(Object.keys(location)),
				location.label,
				location.kind,
				location.definitionRevision,
				location.memberGeography,
				location.validity.from,
				location.validity.to,
				...location.bbox,
				location.source === undefined
					? null
					: JSON.stringify(location.source),
			]),
		},
		named_location_members: {
			columns: [
				"locationId TEXT NOT NULL REFERENCES named_locations(id)",
				"position INTEGER NOT NULL",
				"code TEXT NOT NULL",
			],
			key: ["locationId", "position"],
			indexes: [["code", "locationId"]],
			rows: inventory.locations.flatMap((location) =>
				location.memberCodes.map((code, position) => [
					location.id,
					position,
					code,
				]),
			),
		},
		named_location_assertions: {
			columns: [
				"locationId TEXT NOT NULL REFERENCES named_locations(id)",
				"position INTEGER NOT NULL",
				"code TEXT NOT NULL",
				"validFrom TEXT",
				"validTo TEXT",
			],
			key: ["locationId", "position"],
			indexes: [["locationId", "code", "validFrom", "validTo"]],
			rows: inventory.locations.flatMap((location) =>
				(location.memberAssertions ?? []).map((member, position) => [
					location.id,
					position,
					member.code,
					member.validity.from,
					member.validity.to,
				]),
			),
		},
		named_location_partial_members: {
			columns: [
				"locationId TEXT NOT NULL REFERENCES named_locations(id)",
				"position INTEGER NOT NULL",
				"code TEXT NOT NULL",
				"share REAL NOT NULL",
				"memberOf TEXT NOT NULL REFERENCES named_locations(id)",
			],
			key: ["locationId", "position"],
			indexes: [["code", "locationId"]],
			rows: inventory.locations.flatMap((location) =>
				(location.partialMembers ?? []).map((member, position) => [
					location.id,
					position,
					member.code,
					member.share,
					member.memberOf,
				]),
			),
		},
		named_location_geometries: {
			columns: [
				"locationId TEXT NOT NULL REFERENCES named_locations(id)",
				"boundaryRelease TEXT NOT NULL",
				"minX REAL NOT NULL",
				"minY REAL NOT NULL",
				"maxX REAL NOT NULL",
				"maxY REAL NOT NULL",
				"geometry TEXT NOT NULL",
			],
			key: ["locationId"],
			rows: inventory.locations.flatMap((location) =>
				location.geometry
					? [
							[
								location.id,
								location.geometry.boundaryRelease,
								...location.geometry.bbox,
								JSON.stringify(location.geometry.geometry),
							],
						]
					: [],
			),
		},
	};
};

export const readSqliteNamedLocationInventory = (
	apiRoot: string,
): NamedLocationInventory => {
	const path = resolve(apiRoot, "../../data/build/atlas.sqlite");
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		const header = database
			.prepare("SELECT * FROM named_location_inventory")
			.get();
		if (!header || header.schemaVersion !== 1)
			throw new Error("Invalid SQLite named location inventory");
		const members = database.prepare(
			"SELECT code FROM named_location_members WHERE locationId = ? ORDER BY position",
		);
		const assertions = database.prepare(
			"SELECT code, validFrom, validTo FROM named_location_assertions WHERE locationId = ? ORDER BY position",
		);
		const partials = database.prepare(
			"SELECT code, share, memberOf FROM named_location_partial_members WHERE locationId = ? ORDER BY position",
		);
		const locations = database
			.prepare("SELECT * FROM named_locations ORDER BY position")
			.all()
			.map((row) => {
				const values = {
					id: row.id,
					label: row.label,
					kind: row.kind,
					definitionRevision: row.definitionRevision,
					memberGeography: row.memberGeography,
					source:
						row.source === null
							? undefined
							: JSON.parse(row.source as string),
					validity: { from: row.validFrom, to: row.validTo },
					bbox: [row.minX, row.minY, row.maxX, row.maxY],
					memberCodes: members
						.all(row.id)
						.map((member) => member.code),
					memberAssertions: assertions.all(row.id).map((member) => ({
						code: member.code,
						validity: {
							from: member.validFrom,
							to: member.validTo,
						},
					})),
					partialMembers: partials.all(row.id).map((member) => ({
						code: member.code,
						share: member.share,
						memberOf: member.memberOf,
					})),
					geometry: undefined,
				};
				const fields: Array<keyof typeof values> = JSON.parse(
					row.fields as string,
				);
				const location = Object.fromEntries(
					fields.map((key) => [key, values[key]]),
				);
				if (fields.includes("geometry")) {
					const geometry = lazyValue((): NamedLocationGeometry => {
						const connection = new DatabaseSync(path, {
							readOnly: true,
						});
						try {
							const shape = connection
								.prepare(
									"SELECT g.* FROM named_location_geometries g JOIN named_location_inventory i ON i.contentHash = ? WHERE g.locationId = ?",
								)
								.get(header.contentHash, row.id);
							if (!shape)
								throw new Error(
									`Missing named location geometry ${row.id}`,
								);
							return {
								boundaryRelease:
									shape.boundaryRelease as string,
								bbox: [
									shape.minX as number,
									shape.minY as number,
									shape.maxX as number,
									shape.maxY as number,
								],
								geometry: JSON.parse(shape.geometry as string),
							};
						} finally {
							connection.close();
						}
					});
					Object.defineProperty(location, "geometry", {
						enumerable: true,
						get: geometry,
					});
				}
				return location as NamedLocation;
			});
		return {
			schemaVersion: 1,
			contentHash: header.contentHash as string,
			source: {
				artifact:
					header.artifact as NamedLocationInventory["source"]["artifact"],
				gazetteerVersion: header.gazetteerVersion as number,
			},
			locations,
		};
	} finally {
		database.close();
	}
};
