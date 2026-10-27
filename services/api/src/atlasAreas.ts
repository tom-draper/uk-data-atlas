import { readFileSync } from "node:fs";
import { join } from "node:path";
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

export {
	readSqliteAreaInventory,
	readSqliteAreas,
} from "../../../shared/atlasAreaReader";
