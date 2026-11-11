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
	WITH period AS (
		SELECT geography, release,
			reference_year * 100 + coalesce(reference_month, 1) AS key
		FROM boundary_release
	)
	SELECT geography, release,
		printf('%04d-%02d-01', key / 100, key % 100) AS edition_from,
		CASE WHEN next_key IS NOT NULL THEN
			printf('%04d-%02d-01', next_key / 100, next_key % 100)
		END AS edition_until
	FROM (
		SELECT p.geography, p.release, p.key,
			(
				SELECT min(n.key) FROM period n
				WHERE n.geography = p.geography AND n.key > p.key
			) AS next_key
		FROM period p
	)`;

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
				"reference_year INTEGER NOT NULL",
				"reference_month INTEGER CHECK (reference_month BETWEEN 1 AND 12)",
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
			views: { boundary_release_edition: BOUNDARY_RELEASE_EDITION_VIEW },
			rows: registry.releases.map((release) => {
				const period = releaseReferencePeriod(release);
				return [
					release.geography,
					release.id,
					release.title,
					release.description ?? null,
					release.temporalCoverage ?? null,
					period.year,
					period.month,
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
				];
			}),
		},
		boundary_release_validity: {
			strict: true,
			columns: [
				"geography TEXT NOT NULL",
				"release TEXT NOT NULL",
				"purpose TEXT NOT NULL CHECK (purpose IN ('election_poll'))",
				"valid_from TEXT NOT NULL",
				"valid_to TEXT NOT NULL",
				"source_url TEXT NOT NULL",
				"note TEXT NOT NULL",
			],
			key: ["geography", "release", "purpose", "valid_from", "valid_to"],
			constraints: [
				"FOREIGN KEY (geography, release) REFERENCES boundary_release(geography, release)",
				"CHECK (valid_from <= valid_to)",
			],
			rows: registry.releases.flatMap((release) =>
				(release.validity ?? []).map((item) => [
					release.geography,
					release.id,
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
