import type { AreaInventory } from "@uk-data-atlas/areas";
import type { IdRegistries } from "../ids/idRegistries.ts";
import type { SqliteTable } from "@uk-data-atlas/artifacts";
import type {
	BoundaryRegistry,
	BoundaryRelease,
} from "@uk-data-atlas/geography";

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

/**
 * The reference period a release is named for: its id starts with the
 * publisher's edition year and, for periodic snapshots, the month
 * (`2023-12-uk-bgc`). A month named in the title must agree with the id.
 */
export const releaseReferencePeriod = (
	release: Pick<BoundaryRelease, "id" | "geography" | "title">,
): { year: number; month: number | null } => {
	const label = `${release.geography}/${release.id}`;
	const match = /^(\d{4})(?:-(\d{2}))?(?:-|$)/.exec(release.id);
	if (!match) throw new Error(`${label}: id does not start with a year`);
	const year = Number(match[1]);
	const month = match[2] === undefined ? null : Number(match[2]);
	if (month !== null && (month < 1 || month > 12)) {
		throw new Error(`${label}: id month ${match[2]} is not 01-12`);
	}
	const titled = new RegExp(`\\b(${MONTHS.join("|")}) (\\d{4})\\b`).exec(
		release.title,
	);
	if (
		titled &&
		(Number(titled[2]) !== year || MONTHS.indexOf(titled[1]) + 1 !== month)
	) {
		throw new Error(`${label}: title says ${titled[0]} but the id differs`);
	}
	return { year, month };
};

/**
 * Edition intervals: each release is the latest snapshot from its reference
 * month until the next later reference period in the same geography. This
 * orders the held snapshots; it is not a legal effective-date interval, which
 * lives in `boundary_release_validity` where evidence exists.
 */
const BOUNDARY_RELEASE_EDITION_VIEW = `
	WITH period(release_id, geography, release, key) AS (
		SELECT id, geography, release,
			reference_year * 100 + coalesce(reference_month, 1) AS key
		FROM area_release
		WHERE reference_year IS NOT NULL
	)
	SELECT release_id, geography, release,
		printf('%04d-%02d-01', key / 100, key % 100) AS edition_from,
		CASE WHEN next_key IS NOT NULL THEN
			printf('%04d-%02d-01', next_key / 100, next_key % 100)
		END AS edition_until
	FROM (
		SELECT p.release_id, p.geography, p.release, p.key,
			(
				SELECT min(n.key) FROM period n
				WHERE n.geography = p.geography AND n.key > p.key
			) AS next_key
		FROM period p
	)`;

/**
 * The area inventory and registry describe the same releases. Give the merged
 * row the inventory's stable id and order, and require an exact match when
 * building the atlas. Area-only fixtures can omit the publisher metadata.
 */
export function areaReleaseTable(
	releases: AreaInventory["releases"],
	releaseIds: readonly number[],
	registry?: BoundaryRegistry,
): SqliteTable {
	const key = (geography: string, release: string) =>
		`${geography}/${release}`;
	const registryByKey = new Map(
		registry?.releases.map((release) => [
			key(release.geography, release.id),
			release,
		]),
	);
	const rows = releases.map((release, position) => {
		const releaseKey = key(release.geography, release.id);
		const boundary = registryByKey.get(releaseKey);
		if (registry && !boundary)
			throw new Error(`Missing boundary registry release ${releaseKey}`);
		registryByKey.delete(releaseKey);
		const period = boundary && releaseReferencePeriod(boundary);
		return [
			releaseIds[position]!,
			release.geography,
			release.id,
			position,
			release.status,
			release.status === "available" ? null : release.reason,
			boundary?.title ?? null,
			boundary?.description ?? null,
			boundary?.temporalCoverage ?? null,
			period?.year ?? null,
			period?.month ?? null,
			boundary?.source.publisher ?? null,
			boundary?.source.url ?? null,
			boundary?.source.retrievedAt ?? null,
			boundary?.source.licence.name ?? null,
			boundary?.source.licence.url ?? null,
			boundary?.deprecation?.deprecated ?? null,
			boundary?.deprecation?.sunset ?? null,
			boundary?.deprecation?.replacedBy ?? null,
			boundary?.deprecation?.reason ?? null,
		];
	});
	if (registryByKey.size)
		throw new Error(
			`Boundary registry releases missing from area inventory: ${[...registryByKey.keys()].join(", ")}`,
		);
	return {
		rowid: true,
		strict: true,
		columns: [
			"id INTEGER",
			"geography TEXT NOT NULL REFERENCES geography(slug)",
			"release TEXT NOT NULL",
			"inventory_position INTEGER NOT NULL UNIQUE",
			"status TEXT NOT NULL",
			"reason TEXT",
			`title TEXT${registry ? " NOT NULL" : ""}`,
			"description TEXT",
			"temporal_coverage TEXT",
			`reference_year INTEGER${registry ? " NOT NULL" : ""}`,
			"reference_month INTEGER CHECK (reference_month BETWEEN 1 AND 12)",
			`publisher TEXT${registry ? " NOT NULL" : ""}`,
			`source_url TEXT${registry ? " NOT NULL" : ""}`,
			"retrieved_at TEXT",
			`licence TEXT${registry ? " NOT NULL" : ""}`,
			"licence_url TEXT",
			"deprecated TEXT",
			"sunset TEXT",
			"replaced_by TEXT",
			"deprecation_reason TEXT",
		],
		key: ["id"],
		constraints: ["UNIQUE (geography, release)"],
		views: { boundary_release_edition: BOUNDARY_RELEASE_EDITION_VIEW },
		rows,
	};
}

export function boundaryReleaseTables(
	registry: BoundaryRegistry,
	ids: IdRegistries,
): Record<string, SqliteTable> {
	return {
		boundary_registry: {
			build: true,
			strict: true,
			columns: [
				"schema_version INTEGER NOT NULL",
				"content_hash TEXT NOT NULL",
			],
			rows: [[registry.schemaVersion, registry.contentHash]],
		},
		boundary_release_build: {
			build: true,
			strict: true,
			columns: [
				"geography TEXT NOT NULL",
				"release TEXT NOT NULL",
				"metadata_hash TEXT NOT NULL",
			],
			key: ["geography", "release"],
			rows: registry.releases.map((release) => [
				release.geography,
				release.id,
				release.metadataHash,
			]),
		},
		boundary_release_validity: {
			strict: true,
			columns: [
				"release_id INTEGER NOT NULL REFERENCES area_release(id)",
				"purpose TEXT NOT NULL CHECK (purpose IN ('election_poll'))",
				"valid_from TEXT NOT NULL",
				"valid_to TEXT NOT NULL",
				"source_url TEXT NOT NULL",
				"note TEXT NOT NULL",
			],
			key: ["release_id", "purpose", "valid_from", "valid_to"],
			constraints: ["CHECK (valid_from <= valid_to)"],
			rows: registry.releases.flatMap((release) =>
				(release.validity ?? []).map((item) => [
					ids.release.assign(release.geography, release.id),
					item.purpose,
					item.validFrom,
					item.validTo,
					item.sourceUrl,
					item.note,
				]),
			),
		},
		boundary_release_country: {
			strict: true,
			columns: [
				"release_id INTEGER NOT NULL REFERENCES area_release(id)",
				"country TEXT NOT NULL",
			],
			key: ["release_id", "country"],
			rows: registry.releases.flatMap((release) =>
				release.coverage.countries.map((country) => [
					ids.release.assign(release.geography, release.id),
					country,
				]),
			),
		},
	};
}
