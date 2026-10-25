import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
	AreaInventory,
	AreaRecord,
	AreaReleaseArtifact,
} from "./areaInventory";
import type { SqliteTable } from "./sqliteIndex";

export const areaTables = (directory: string): Record<string, SqliteTable> => {
	const inventory: AreaInventory = JSON.parse(
		readFileSync(join(directory, "area-inventory.json"), "utf8"),
	);
	function* areas() {
		for (const [releasePosition, release] of inventory.releases.entries()) {
			if (release.status !== "available") continue;
			const artifact: AreaReleaseArtifact = JSON.parse(
				readFileSync(join(directory, release.artifact), "utf8"),
			);
			if (
				artifact.schemaVersion !== 1 ||
				artifact.contentHash !== release.contentHash ||
				artifact.areas.length !== release.recordCount
			)
				throw new Error(
					`Invalid area release ${release.geography}/${release.id}`,
				);
			for (const area of artifact.areas)
				yield [
					null,
					releasePosition,
					area.code,
					1,
					area.name,
					area.aliases === undefined
						? null
						: JSON.stringify(area.aliases),
					null,
					null,
				];
		}
	}
	return {
		area_inventory: {
			columns: [
				"schemaVersion INTEGER NOT NULL",
				"contentHash TEXT NOT NULL",
				"boundaryRegistryHash TEXT NOT NULL",
			],
			rows: [
				[
					inventory.schemaVersion,
					inventory.contentHash,
					inventory.boundaryRegistryHash,
				],
			],
		},
		area_releases: {
			columns: [
				"geography TEXT NOT NULL",
				"id TEXT NOT NULL",
				"position INTEGER NOT NULL UNIQUE",
				"status TEXT NOT NULL",
				"recordCount INTEGER",
				"artifact TEXT",
				"contentHash TEXT",
				"codeProperty TEXT",
				"nameProperty TEXT",
				"derivedFrom TEXT",
				"reason TEXT",
			],
			key: ["geography", "id"],
			rows: inventory.releases.map((release, position) =>
				release.status === "available"
					? [
							release.geography,
							release.id,
							position,
							release.status,
							release.recordCount,
							release.artifact,
							release.contentHash,
							release.codeProperty,
							release.nameProperty,
							release.derivedFrom === undefined
								? null
								: JSON.stringify(release.derivedFrom),
							null,
						]
					: [
							release.geography,
							release.id,
							position,
							release.status,
							null,
							null,
							null,
							null,
							null,
							null,
							release.reason,
						],
			),
		},
		areas: {
			rowid: true,
			columns: [
				"id INTEGER",
				"releasePosition INTEGER NOT NULL REFERENCES area_releases(position)",
				"code TEXT NOT NULL",
				"inInventory INTEGER NOT NULL CHECK (inInventory IN (0, 1))",
				"name TEXT NOT NULL",
				"aliases TEXT",
				"areaM2 REAL",
				"population REAL",
			],
			key: ["id"],
			rows: areas(),
			constraints: ["UNIQUE (releasePosition, code)"],
		},
	};
};

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
