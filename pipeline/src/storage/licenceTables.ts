import type { SqliteTable } from "@uk-data-atlas/artifacts";
import type { BoundaryRegistry } from "@uk-data-atlas/geography";
import { IdRegistries } from "../ids/idRegistries.ts";

/** Source licence terms; NULL means the terms have not been classified. */
const LICENCES = [
	[
		"ogl-3.0",
		"Open Government Licence v3.0",
		"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		1,
		0,
	],
	[
		"open-parliament",
		"Open Parliament Licence",
		"https://www.parliament.uk/site-information/copyright/open-parliament-licence/",
		1,
		0,
	],
	[
		"cc-by-sa-3.0",
		"Creative Commons Attribution-ShareAlike 3.0",
		"https://creativecommons.org/licenses/by-sa/3.0/",
		1,
		1,
	],
] as const;

/** Source terms in one row: licences listed, commercial use only if every licence allows it, ShareAlike if any requires it. */
const SOURCE_TERMS_VIEW = `SELECT s.id AS source_id, s.publisher, s.url,
  group_concat(l.id, ', ' ORDER BY l.id) AS licences,
  min(l.commercial_use) AS commercial_use,
  max(l.share_alike) AS share_alike
FROM source s
LEFT JOIN source_licence sl ON sl.source_id = s.id
LEFT JOIN licence l ON l.id = sl.licence_id
GROUP BY s.id`;

/** The licence of each election, so ShareAlike elections can be filtered out or kept apart. */
const ELECTION_TERMS_VIEW = `SELECT e.id AS election_id, d.slug AS dataset, e.label, e.date,
  el.licence_id, l.commercial_use, l.share_alike
FROM election e
JOIN dataset d ON d.id = e.dataset_id
JOIN election_licence el ON el.election_id = e.id
JOIN licence l ON l.id = el.licence_id`;

/** Add boundary sources and explicit licence associations after the statistics tables. */
export function licenceTables(
	registry: BoundaryRegistry,
	ids: IdRegistries,
): Record<string, SqliteTable> {
	return {
		licence: {
			strict: true,
			columns: [
				"id TEXT NOT NULL",
				"name TEXT NOT NULL",
				"url TEXT NOT NULL",
				"commercial_use INTEGER CHECK (commercial_use IN (0, 1))",
				"share_alike INTEGER CHECK (share_alike IN (0, 1))",
			],
			key: ["id"],
			rows: LICENCES.map((row) => [...row]),
		},
		boundary_release_source: {
			strict: true,
			columns: [
				"geography TEXT NOT NULL",
				"release TEXT NOT NULL",
				"source_id INTEGER NOT NULL REFERENCES source(id)",
			],
			key: ["geography", "release"],
			constraints: [
				"FOREIGN KEY (geography, release) REFERENCES boundary_release(geography, release)",
			],
			rows: function* (database) {
				const insert = database.prepare(
					"INSERT OR IGNORE INTO source (id, publisher, url, licence, licence_url, citation) VALUES (?, ?, ?, ?, ?, NULL)",
				);
				for (const release of registry.releases) {
					const source = release.source;
					const id = ids.source.assign(
						JSON.stringify([
							source.publisher,
							source.url,
							source.licence.name,
						]),
					);
					insert.run(
						id,
						source.publisher,
						source.url,
						source.licence.name,
						source.licence.url ?? null,
					);
					yield [release.geography, release.id, id];
				}
			},
		},
		source_licence: {
			strict: true,
			columns: [
				"source_id INTEGER NOT NULL REFERENCES source(id)",
				"licence_id TEXT NOT NULL REFERENCES licence(id)",
			],
			key: ["source_id", "licence_id"],
			views: { v_source_terms: SOURCE_TERMS_VIEW },
			rows: function* (database) {
				for (const source of database
					.prepare("SELECT id, licence FROM source")
					.iterate()) {
					const known: Record<string, readonly string[]> = {
						"Open Government Licence v3.0": ["ogl-3.0"],
						"Open Parliament Licence": ["open-parliament"],
						"Open Parliament Licence (2021–2025); CC BY-SA 3.0 (2016–2019)":
							["open-parliament", "cc-by-sa-3.0"],
					};
					for (const licence of known[String(source.licence)] ?? [])
						yield [source.id as number, licence];
				}
			},
		},
		election_licence: {
			strict: true,
			columns: [
				"election_id INTEGER NOT NULL REFERENCES election(id)",
				"licence_id TEXT NOT NULL REFERENCES licence(id)",
			],
			key: ["election_id", "licence_id"],
			views: { v_election_terms: ELECTION_TERMS_VIEW },
			rows: function* (database) {
				for (const election of database
					.prepare(
						"SELECT e.id, e.date FROM election e JOIN dataset d ON d.id = e.dataset_id WHERE d.slug = 'local-election'",
					)
					.iterate()) {
					const year = Number(String(election.date).slice(0, 4));
					if (year >= 2016 && year <= 2019)
						yield [election.id as number, "cc-by-sa-3.0"];
					else if (year >= 2021 && year <= 2025)
						yield [election.id as number, "open-parliament"];
					else
						throw new Error(
							`Unknown local election licence for ${year}`,
						);
				}
			},
		},
		crosswalk_provenance_source: {
			strict: true,
			columns: [
				"crosswalk_id INTEGER NOT NULL REFERENCES crosswalk(id)",
				"source_id INTEGER NOT NULL REFERENCES source(id)",
				"input TEXT NOT NULL",
			],
			key: ["crosswalk_id", "source_id", "input"],
			rows: function* (database) {
				const find = database.prepare(
					"SELECT source_id FROM boundary_release_source WHERE geography = ? AND release = ?",
				);
				const normalise = (value: string) =>
					value.replace(/[^a-z0-9]/gi, "").toLowerCase();
				const releaseByPath = new Map(
					registry.releases.map((release) => [
						`${normalise(release.geography)}/${release.id}`,
						release,
					]),
				);
				for (const row of database
					.prepare("SELECT id, provenance FROM crosswalk")
					.iterate()) {
					const provenance =
						row.provenance === null
							? {}
							: JSON.parse(String(row.provenance));
					// Postcode-overlap records its geometry by release and hash,
					// rather than by a boundary file path.
					for (const item of provenance?.inputs ?? []) {
						if (
							typeof item.geography !== "string" ||
							typeof item.boundaryRelease !== "string" ||
							typeof item.geometryInput !== "string"
						)
							continue;
						const source = find.get(
							item.geography,
							item.boundaryRelease,
						);
						if (!source)
							throw new Error(
								`Missing boundary source ${item.geography}/${item.boundaryRelease}`,
							);
						yield [
							row.id as number,
							source.source_id as number,
							`geometry:${item.geography}/${item.boundaryRelease}:${item.geometryInput}`,
						];
					}
					const inputs = [
						provenance?.input,
						...(provenance?.inputs ?? []).map(
							(item: { input?: string }) => item.input,
						),
						provenance?.blocks?.input,
					];
					const seen = new Set<string>();
					for (const input of inputs) {
						if (typeof input !== "string" || seen.has(input))
							continue;
						seen.add(input);
						const match = /^boundaries\/([^/]+)\/([^/]+)\//.exec(
							input,
						);
						if (!match) continue;
						const release = releaseByPath.get(
							`${normalise(match[1]!)}/${match[2]!}`,
						);
						if (!release) continue;
						const source = find.get(release.geography, release.id);
						if (source)
							yield [
								row.id as number,
								source.source_id as number,
								input,
							];
					}
				}
			},
		},
	};
}
