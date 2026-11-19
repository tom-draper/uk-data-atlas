import type { AreaInventory, AreaRecord } from "./index.ts";
import { atlasDatabasePath } from "@uk-data-atlas/atlas-db";
import {
	openBuildMetadata,
	openReadOnlyDatabase,
} from "@uk-data-atlas/atlas-db";

export const readSqliteAreaInventory = (
	repositoryRoot: string,
	databasePath = atlasDatabasePath(repositoryRoot),
): AreaInventory => {
	const database = openReadOnlyDatabase(databasePath);
	try {
		const build = openBuildMetadata(databasePath);
		let header;
		let built: Map<string, Record<string, unknown>>;
		try {
			header = build
				.prepare(
					"SELECT schema_version AS schemaVersion, content_hash AS contentHash, boundary_registry_hash AS boundaryRegistryHash FROM area_inventory_metadata",
				)
				.get();
			built = new Map(
				build
					.prepare(
						"SELECT geography, release, record_count AS recordCount, artifact, content_hash AS contentHash, code_property AS codeProperty, name_property AS nameProperty, derived_from AS derivedFrom FROM area_release_build",
					)
					.all()
					.map((row) => [`${row.geography}/${row.release}`, row]),
			);
		} finally {
			build.release();
		}
		if (!header || header.schemaVersion !== 1)
			throw new Error("Invalid SQLite area inventory");
		const releases = database
			.prepare(
				"SELECT release, geography, status, reason FROM area_release ORDER BY inventory_position",
			)
			.all()
			.map((row) => {
				const identity = {
					id: row.release as string,
					geography: row.geography as string,
				};
				if (row.status !== "available")
					return {
						...identity,
						status: "not-compiled" as const,
						reason: row.reason as string,
					};
				const artifact = built.get(
					`${identity.geography}/${identity.id}`,
				);
				if (!artifact)
					throw new Error(
						`Missing area release build row ${identity.geography}/${identity.id}`,
					);
				return {
					...identity,
					status: "available" as const,
					recordCount: artifact.recordCount as number,
					artifact: artifact.artifact as string,
					contentHash: artifact.contentHash as string,
					codeProperty: artifact.codeProperty as string,
					nameProperty: artifact.nameProperty as string,
					...(artifact.derivedFrom === null
						? {}
						: {
								derivedFrom: JSON.parse(
									artifact.derivedFrom as string,
								),
							}),
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
				"SELECT id FROM area_release WHERE geography = ? AND release = ?",
			)
			.get(release.geography, release.id);
		const build = openBuildMetadata(databasePath);
		let hash;
		try {
			hash = build
				.prepare(
					"SELECT content_hash FROM area_release_build WHERE geography = ? AND release = ?",
				)
				.get(release.geography, release.id)?.content_hash;
		} finally {
			build.release();
		}
		if (!header || hash !== release.contentHash)
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
