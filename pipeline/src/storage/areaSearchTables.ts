import {
	AREA_SEARCH_CODES_VIEW,
	AREA_SEARCH_TERMS_VIEW,
	AREA_SEARCH_TITLE_TERMS_VIEW,
} from "./deprecatedViews.ts";
import type { SqliteTable } from "@uk-data-atlas/artifacts";
import { packPositions } from "@uk-data-atlas/search-index";
import type { AreaSearchIndexArtifact } from "@uk-data-atlas/atlas-runtime/areas";

/** Codes in position order and term postings packed as u32s. */
export const areaSearchIndexTables = (
	index: AreaSearchIndexArtifact,
): Record<string, SqliteTable> => ({
	area_search_meta: {
		columns: ["key TEXT NOT NULL", "value TEXT NOT NULL"],
		key: ["key"],
		rows: Object.entries({
			schemaVersion: String(index.schemaVersion),
			contentHash: index.contentHash,
			nameNormalisation: index.nameNormalisation,
			areaInventoryHash: index.areaInventoryHash,
			releases: JSON.stringify(
				index.releases.map(({ geography, boundaryRelease, codes }) => ({
					geography,
					boundaryRelease,
					length: codes.length,
				})),
			),
		}),
	},
	area_search_code: {
		views: { area_search_codes: AREA_SEARCH_CODES_VIEW },
		columns: ["code TEXT"],
		rows: index.releases.flatMap((release) =>
			release.codes.map((code) => [code]),
		),
	},
	area_search_term: {
		views: { area_search_terms: AREA_SEARCH_TERMS_VIEW },
		columns: ["term TEXT", "areas BLOB"],
		rows: index.terms.map((term, at) => [
			term,
			packPositions(index.termAreas[at]!),
		]),
	},
	area_search_title_term: {
		views: { area_search_title_terms: AREA_SEARCH_TITLE_TERMS_VIEW },
		columns: ["term TEXT", "areas BLOB"],
		rows: index.titleTerms.map((term, at) => [
			term,
			packPositions(index.titleTermAreas[at]!),
		]),
	},
});
