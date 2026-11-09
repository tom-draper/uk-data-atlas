import type { AreaInventory, AreaRecord } from "@uk-data-atlas/areas";
import { atlasDatabasePath } from "@uk-data-atlas/atlas-db";
import { openReadOnlyDatabase } from "@uk-data-atlas/atlas-db";

export const readSqliteAreaInventory = (
	repositoryRoot: string,
	databasePath = atlasDatabasePath(repositoryRoot),
): AreaInventory => {
	const database = openReadOnlyDatabase(databasePath);
	try {
		const header = database
			.prepare(
				"SELECT schema_version AS schemaVersion, content_hash AS contentHash, boundary_registry_hash AS boundaryRegistryHash FROM area_inventory_metadata",
			)
			.get();
		if (!header || header.schemaVersion !== 1)
			throw new Error("Invalid SQLite area inventory");
		const releases = database
			.prepare("SELECT * FROM area_releases ORDER BY inventory_position")
			.all()
			.map((row) => {
				const identity = {
					id: row.release as string,
					geography: row.geography as string,
				};
				return row.status === "available"
					? {
							...identity,
							status: "available" as const,
							recordCount: row.recordCount as number,
							artifact: row.artifact as string,
							contentHash: row.contentHash as string,
							codeProperty: row.codeProperty as string,
							nameProperty: row.nameProperty as string,
							...(row.derivedFrom === null
								? {}
								: {
										derivedFrom: JSON.parse(
											row.derivedFrom as string,
										),
									}),
						}
					: {
							...identity,
							status: "not-compiled" as const,
							reason: row.reason as string,
						};
			});
		return {
			schemaVersion: 1,
			contentHash: header.contentHash as string,
			boundaryRegistryHash: header.boundaryRegistryHash as string,
			releases,
		};
	} finally {
		database.release();
	}
};

export const readSqliteAreas = (
	repositoryRoot: string,
	release: Extract<
		AreaInventory["releases"][number],
		{ status: "available" }
	>,
	databasePath = atlasDatabasePath(repositoryRoot),
): AreaRecord[] => {
	const database = openReadOnlyDatabase(databasePath);
	try {
		const header = database
			.prepare(
				"SELECT id, contentHash FROM area_releases WHERE geography = ? AND release = ?",
			)
			.get(release.geography, release.id);
		if (header?.contentHash !== release.contentHash)
			throw new Error(
				`Invalid area release ${release.geography}/${release.id}`,
			);
		const rows = database
			.prepare(
				"SELECT a.code AS code, v.name AS name, v.aliases AS aliases FROM area_version v JOIN area a ON a.id = v.area_id WHERE v.release_id = ? AND v.in_inventory = 1 ORDER BY v.inventory_position",
			)
			.all(header.id);
		if (rows.length !== release.recordCount)
			throw new Error(
				`Invalid area release ${release.geography}/${release.id}`,
			);
		return rows.map((row) => ({
			code: row.code as string,
			name: row.name as string,
			...(row.aliases === null
				? {}
				: { aliases: JSON.parse(row.aliases as string) }),
		}));
	} finally {
		database.release();
	}
};
