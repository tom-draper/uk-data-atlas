import { lazyValue } from "@uk-data-atlas/atlas-db";
import type { NamedLocation, NamedLocationInventory } from "./index.ts";
import type { NamedLocationGeometry } from "@uk-data-atlas/geography";
import { atlasDatabasePath } from "@uk-data-atlas/atlas-db";
import {
	openBuildMetadata,
	openReadOnlyDatabase,
} from "@uk-data-atlas/atlas-db";
import { unpackGeometry } from "@uk-data-atlas/atlas-db";

export const readSqliteNamedLocationInventory = (
	repositoryRoot: string,
	databasePath = atlasDatabasePath(repositoryRoot),
): NamedLocationInventory => {
	const path = databasePath;
	const database = openReadOnlyDatabase(path);
	try {
		const build = openBuildMetadata(path);
		let header;
		try {
			header = build
				.prepare(
					"SELECT schema_version AS schemaVersion, content_hash AS contentHash, artifact, gazetteer_version AS gazetteerVersion FROM named_location_inventory_metadata",
				)
				.get();
		} finally {
			build.release();
		}
		if (!header || header.schemaVersion !== 1)
			throw new Error("Invalid SQLite named location inventory");
		const members = database.prepare(
			"SELECT a.code FROM place_member m JOIN area a ON a.id = m.area_id WHERE m.place_id = ? ORDER BY m.position",
		);
		const assertions = database.prepare(
			"SELECT a.code, m.valid_from AS validFrom, m.valid_to AS validTo FROM place_assertion m JOIN area a ON a.id = m.area_id WHERE m.place_id = ? ORDER BY m.position",
		);
		const partials = database.prepare(
			"SELECT a.code, m.share, o.slug AS memberOf FROM place_partial_member m JOIN area a ON a.id = m.area_id JOIN place o ON o.id = m.member_of WHERE m.place_id = ? ORDER BY m.position",
		);
		const locations = database
			.prepare(
				"SELECT id AS placeId, slug AS id, position, fields, label, kind, definition_revision AS definitionRevision, member_geography AS memberGeography, valid_from AS validFrom, valid_to AS validTo, min_x AS minX, min_y AS minY, max_x AS maxX, max_y AS maxY, source FROM place ORDER BY position",
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
						.all(row.placeId)
						.map((member) => member.code),
					memberAssertions: assertions
						.all(row.placeId)
						.map((member) => ({
							code: member.code,
							validity: {
								from: member.validFrom,
								to: member.validTo,
							},
						})),
					partialMembers: partials.all(row.placeId).map((member) => ({
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
							const current = openBuildMetadata(path);
							let published;
							try {
								published = current
									.prepare(
										"SELECT 1 FROM named_location_inventory_metadata WHERE content_hash = ?",
									)
									.get(header.contentHash);
							} finally {
								current.release();
							}
							const shape = published
								? connection
										.prepare(
											"SELECT boundary_release AS boundaryRelease, min_x AS minX, min_y AS minY, max_x AS maxX, max_y AS maxY, geometry FROM place_geometry WHERE place_id = ?",
										)
										.get(row.placeId)
								: undefined;
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
