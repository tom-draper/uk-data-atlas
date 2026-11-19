import { join } from "node:path";
import type {
	NamedLocation,
	NamedLocationInventory,
} from "@uk-data-atlas/places";
import type { SqliteTable } from "@uk-data-atlas/artifacts";
import { packGeometry } from "@uk-data-atlas/atlas-db";
import { readJsonSync } from "../lib/json.ts";
import type { IdRegistries } from "../ids/idRegistries.ts";

/**
 * The places of the gazetteer. A place has a stable integer id from
 * `pipeline/ids/place.txt` and keeps its text id as `slug`, which is what the
 * API and the artifacts call it. Its members point at `area`, so a place is
 * joined to its areas, and a code that is not an area fails the build.
 */
export const namedLocationTables = (
	directory: string,
	ids: IdRegistries,
): Record<string, SqliteTable> => {
	const inventory: NamedLocationInventory = readJsonSync(
		join(directory, "named-locations.json"),
	);
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.locations))
		throw new Error("Invalid named location inventory");
	const placeIds = new Map(
		inventory.locations.map((location) => [
			location.id,
			ids.place.assign(location.id),
		]),
	);
	const placeId = (slug: string) => {
		const id = placeIds.get(slug);
		if (id === undefined) throw new Error(`Unknown place ${slug}`);
		return id;
	};
	const areaId = (location: NamedLocation, code: string) => {
		const id = ids.area.id(location.memberGeography, code);
		if (id === undefined)
			throw new Error(
				`Place ${location.id} names ${location.memberGeography} ${code}, which is not an area`,
			);
		return id;
	};
	return {
		named_location_inventory_metadata: {
			build: true,
			strict: true,
			columns: [
				"schema_version INTEGER NOT NULL",
				"content_hash TEXT NOT NULL",
				"artifact TEXT NOT NULL",
				"gazetteer_version INTEGER NOT NULL",
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
		place: {
			strict: true,
			columns: [
				"id INTEGER NOT NULL",
				"slug TEXT NOT NULL UNIQUE",
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
				placeId(location.id),
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
		place_member: {
			strict: true,
			columns: [
				"place_id INTEGER NOT NULL REFERENCES place(id)",
				"position INTEGER NOT NULL",
				"area_id INTEGER NOT NULL REFERENCES area(id)",
			],
			key: ["place_id", "position"],
			indexes: [["area_id", "place_id"]],
			rows: () =>
				inventory.locations.flatMap((location) =>
					location.memberCodes.map((code, position) => [
						placeId(location.id),
						position,
						areaId(location, code),
					]),
				),
		},
		place_assertion: {
			strict: true,
			columns: [
				"place_id INTEGER NOT NULL REFERENCES place(id)",
				"position INTEGER NOT NULL",
				"area_id INTEGER NOT NULL REFERENCES area(id)",
				"valid_from TEXT",
				"valid_to TEXT",
			],
			key: ["place_id", "position"],
			indexes: [["place_id", "area_id", "valid_from", "valid_to"]],
			rows: () =>
				inventory.locations.flatMap((location) =>
					(location.memberAssertions ?? []).map(
						(member, position) => [
							placeId(location.id),
							position,
							areaId(location, member.code),
							member.validity.from,
							member.validity.to,
						],
					),
				),
		},
		place_partial_member: {
			strict: true,
			columns: [
				"place_id INTEGER NOT NULL REFERENCES place(id)",
				"position INTEGER NOT NULL",
				"area_id INTEGER NOT NULL REFERENCES area(id)",
				"share REAL NOT NULL",
				"member_of INTEGER NOT NULL REFERENCES place(id)",
			],
			key: ["place_id", "position"],
			indexes: [["area_id", "place_id"]],
			rows: () =>
				inventory.locations.flatMap((location) =>
					(location.partialMembers ?? []).map((member, position) => [
						placeId(location.id),
						position,
						areaId(location, member.code),
						member.share,
						placeId(member.memberOf),
					]),
				),
		},
		place_geometry: {
			strict: true,
			columns: [
				"place_id INTEGER NOT NULL REFERENCES place(id)",
				"boundary_release TEXT NOT NULL",
				"min_x REAL NOT NULL",
				"min_y REAL NOT NULL",
				"max_x REAL NOT NULL",
				"max_y REAL NOT NULL",
				"geometry BLOB NOT NULL",
			],
			key: ["place_id"],
			// Rounded to about a metre and compressed. The bounds are measured
			// from the rounded shape so they match what readers return.
			rows: inventory.locations.flatMap((location) => {
				if (!location.geometry) return [];
				const { geometry, bbox } = packGeometry(
					location.geometry.geometry,
				);
				return [
					[
						placeId(location.id),
						location.geometry.boundaryRelease,
						...bbox,
						geometry,
					],
				];
			}),
		},
	};
};
