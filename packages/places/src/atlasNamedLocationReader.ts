import { lazyValue } from "@uk-data-atlas/atlas-db";
import type { NamedLocation, NamedLocationInventory } from "./index.ts";
import type { NamedLocationGeometry } from "@uk-data-atlas/geography";
import { atlasDatabasePath } from "@uk-data-atlas/atlas-db";
import { openReadOnlyDatabase } from "@uk-data-atlas/atlas-db";
import { unpackGeometry } from "@uk-data-atlas/atlas-db";

export const readSqliteNamedLocationInventory = (
	repositoryRoot: string,
	databasePath = atlasDatabasePath(repositoryRoot),
): NamedLocationInventory => {
	const path = databasePath;
	const database = openReadOnlyDatabase(path);
	try {
		const header = database
			.prepare(
				"SELECT schema_version AS schemaVersion, content_hash AS contentHash, artifact, gazetteer_version AS gazetteerVersion FROM named_location_inventory_metadata",
			)
			.get();
		if (!header || header.schemaVersion !== 1)
			throw new Error("Invalid SQLite named location inventory");
		const members = database.prepare(
			"SELECT code FROM named_location_member WHERE location_id = ? ORDER BY position",
		);
		const assertions = database.prepare(
			"SELECT code, valid_from AS validFrom, valid_to AS validTo FROM named_location_assertion WHERE location_id = ? ORDER BY position",
		);
		const partials = database.prepare(
			"SELECT code, share, member_of AS memberOf FROM named_location_partial_member WHERE location_id = ? ORDER BY position",
		);
		const locations = database
			.prepare(
				"SELECT id, position, fields, label, kind, definition_revision AS definitionRevision, member_geography AS memberGeography, valid_from AS validFrom, valid_to AS validTo, min_x AS minX, min_y AS minY, max_x AS maxX, max_y AS maxY, source FROM named_location ORDER BY position",
			)
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
						const connection = openReadOnlyDatabase(path);
						try {
							const shape = connection
								.prepare(
									"SELECT g.boundary_release AS boundaryRelease, g.min_x AS minX, g.min_y AS minY, g.max_x AS maxX, g.max_y AS maxY, g.geometry FROM named_location_geometry g JOIN named_location_inventory_metadata i ON i.content_hash = ? WHERE g.location_id = ?",
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
								geometry: unpackGeometry(shape.geometry),
							};
						} finally {
							connection.release();
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
		database.release();
	}
};
