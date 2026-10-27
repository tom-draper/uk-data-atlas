import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AreaInventory, AreaRecord } from "./areaInventory";

export const readSqliteAreaInventory = (apiRoot: string): AreaInventory => {
	const database = new DatabaseSync(
		resolve(apiRoot, "../../data/build/atlas.sqlite"),
		{ readOnly: true },
	);
	try {
		const header = database
			.prepare(
				"SELECT schemaVersion, contentHash, boundaryRegistryHash FROM area_inventory",
			)
			.get();
		if (!header || header.schemaVersion !== 1)
			throw new Error("Invalid SQLite area inventory");
		const releases = database
			.prepare("SELECT * FROM area_releases ORDER BY position")
			.all()
			.map((row) => {
				const identity = {
					id: row.id as string,
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
		database.close();
	}
};

export const readSqliteAreas = (
	apiRoot: string,
	release: Extract<
		AreaInventory["releases"][number],
		{ status: "available" }
	>,
): AreaRecord[] => {
	const database = new DatabaseSync(
		resolve(apiRoot, "../../data/build/atlas.sqlite"),
		{ readOnly: true },
	);
	try {
		const header = database
			.prepare(
				"SELECT position, contentHash FROM area_releases WHERE geography = ? AND id = ?",
			)
			.get(release.geography, release.id);
		if (header?.contentHash !== release.contentHash)
			throw new Error(
				`Invalid area release ${release.geography}/${release.id}`,
			);
		const rows = database
			.prepare(
				"SELECT code, name, aliases FROM areas WHERE releasePosition = ? AND inInventory = 1 ORDER BY id",
			)
			.all(header.position);
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
		database.close();
	}
};
