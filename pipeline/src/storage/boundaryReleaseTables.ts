import type { SqliteTable } from "@uk-data-atlas/artifacts";
import type { BoundaryRegistry } from "@uk-data-atlas/geography";

/** Source metadata for every boundary release, including releases without areas. */
export function boundaryReleaseTables(
	registry: BoundaryRegistry,
): Record<string, SqliteTable> {
	return {
		boundary_registry: {
			strict: true,
			columns: [
				"schema_version INTEGER NOT NULL",
				"content_hash TEXT NOT NULL",
			],
			rows: [[registry.schemaVersion, registry.contentHash]],
		},
		boundary_release: {
			strict: true,
			columns: [
				"geography TEXT NOT NULL",
				"release TEXT NOT NULL",
				"title TEXT NOT NULL",
				"description TEXT",
				"temporal_coverage TEXT",
				"publisher TEXT NOT NULL",
				"source_url TEXT NOT NULL",
				"retrieved_at TEXT",
				"licence TEXT NOT NULL",
				"licence_url TEXT",
				"metadata_hash TEXT NOT NULL",
				"deprecated TEXT",
				"sunset TEXT",
				"replaced_by TEXT",
				"deprecation_reason TEXT",
			],
			key: ["geography", "release"],
			rows: registry.releases.map((release) => [
				release.geography,
				release.id,
				release.title,
				release.description ?? null,
				release.temporalCoverage ?? null,
				release.source.publisher,
				release.source.url,
				release.source.retrievedAt ?? null,
				release.source.licence.name,
				release.source.licence.url ?? null,
				release.metadataHash,
				release.deprecation?.deprecated ?? null,
				release.deprecation?.sunset ?? null,
				release.deprecation?.replacedBy ?? null,
				release.deprecation?.reason ?? null,
			]),
		},
		boundary_release_country: {
			strict: true,
			columns: [
				"geography TEXT NOT NULL",
				"release TEXT NOT NULL",
				"country TEXT NOT NULL",
			],
			key: ["geography", "release", "country"],
			constraints: [
				"FOREIGN KEY (geography, release) REFERENCES boundary_release(geography, release)",
			],
			rows: registry.releases.flatMap((release) =>
				release.coverage.countries.map((country) => [
					release.geography,
					release.id,
					country,
				]),
			),
		},
	};
}
