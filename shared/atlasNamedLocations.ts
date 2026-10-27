import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	NamedLocation,
	NamedLocationInventory,
} from "./namedLocationTypes";
import type { SqliteTable } from "./sqliteTables";

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
