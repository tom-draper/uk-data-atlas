import { NAMED_LOCATIONS_VIEW, NAMED_LOCATION_MEMBERS_VIEW, NAMED_LOCATION_ASSERTIONS_VIEW, NAMED_LOCATION_PARTIAL_MEMBERS_VIEW, NAMED_LOCATION_GEOMETRIES_VIEW } from "./deprecatedViews.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	NamedLocation,
	NamedLocationInventory,
} from "@uk-data-atlas/places";
import type { SqliteTable } from "@uk-data-atlas/artifacts";
import { packGeometry } from "@uk-data-atlas/atlas-runtime/storage";

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
		named_location: {
			views: { named_locations: NAMED_LOCATIONS_VIEW },
			columns: [
				"id TEXT NOT NULL",
				"position INTEGER NOT NULL UNIQUE",
				"fields TEXT NOT NULL",
				"label TEXT NOT NULL",
				"kind TEXT NOT NULL",
				"definition_revision INTEGER NOT NULL",
				"member_geography TEXT NOT NULL",
				"valid_from TEXT",
				"valid_to TEXT",
				"min_x REAL NOT NULL",
				"min_y REAL NOT NULL",
				"max_x REAL NOT NULL",
				"max_y REAL NOT NULL",
				"source TEXT",
			],
			key: ["id"],
			indexes: [
				["kind", "position"],
				["member_geography", "position"],
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
		named_location_member: {
			views: { named_location_members: NAMED_LOCATION_MEMBERS_VIEW },
			columns: [
				"location_id TEXT NOT NULL REFERENCES named_location(id)",
				"position INTEGER NOT NULL",
				"code TEXT NOT NULL",
			],
			key: ["location_id", "position"],
			indexes: [["code", "location_id"]],
			rows: inventory.locations.flatMap((location) =>
				location.memberCodes.map((code, position) => [
					location.id,
					position,
					code,
				]),
			),
		},
		named_location_assertion: {
			views: { named_location_assertions: NAMED_LOCATION_ASSERTIONS_VIEW },
			columns: [
				"location_id TEXT NOT NULL REFERENCES named_location(id)",
				"position INTEGER NOT NULL",
				"code TEXT NOT NULL",
				"valid_from TEXT",
				"valid_to TEXT",
			],
			key: ["location_id", "position"],
			indexes: [["location_id", "code", "valid_from", "valid_to"]],
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
		named_location_partial_member: {
			views: { named_location_partial_members: NAMED_LOCATION_PARTIAL_MEMBERS_VIEW },
			columns: [
				"location_id TEXT NOT NULL REFERENCES named_location(id)",
				"position INTEGER NOT NULL",
				"code TEXT NOT NULL",
				"share REAL NOT NULL",
				"member_of TEXT NOT NULL REFERENCES named_location(id)",
			],
			key: ["location_id", "position"],
			indexes: [["code", "location_id"]],
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
		named_location_geometry: {
			views: { named_location_geometries: NAMED_LOCATION_GEOMETRIES_VIEW },
			columns: [
				"location_id TEXT NOT NULL REFERENCES named_location(id)",
				"boundary_release TEXT NOT NULL",
				"min_x REAL NOT NULL",
				"min_y REAL NOT NULL",
				"max_x REAL NOT NULL",
				"max_y REAL NOT NULL",
				"geometry BLOB NOT NULL",
			],
			key: ["location_id"],
			// Rounded to about a metre and compressed. The bounds are measured
			// from the rounded shape so they match what readers return.
			rows: inventory.locations.flatMap((location) => {
				if (!location.geometry) return [];
				const { geometry, bbox } = packGeometry(
					location.geometry.geometry,
				);
				return [
					[
						location.id,
						location.geometry.boundaryRelease,
						...bbox,
						geometry,
					],
				];
			}),
		},
	};
};
