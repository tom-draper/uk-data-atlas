import { DatabaseSync } from "node:sqlite";
import { lazyValue } from "./lazyValue";
import type {
	NamedLocation,
	NamedLocationInventory,
} from "@uk-data-atlas/places";
import type { NamedLocationGeometry } from "@uk-data-atlas/geography/geometry-types";
import { atlasDatabasePath } from "./dataLayout";

export const readSqliteNamedLocationInventory = (
	apiRoot: string,
): NamedLocationInventory => {
	const path = atlasDatabasePath(apiRoot);
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
