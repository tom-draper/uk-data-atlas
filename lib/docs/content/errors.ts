/**
 * Plain explanations of the `code` a refusal carries, keyed by the values the
 * spec's `Problem` schema lists. The docs tests keep the two in step.
 */
export interface ErrorCodeContent {
	status: number;
	meaning: string;
	fix: string;
}

export const ERROR_CODES: Record<string, ErrorCodeContent> = {
	unsupported_geography: {
		status: 404,
		meaning: "That geography or boundary release isn't available.",
		fix: "Check the spelling against [List geographies](/docs/v1/reference/geography/list-geographies) and [List boundary releases](/docs/v1/reference/geography/list-boundary-releases).",
	},
	area_not_in_release: {
		status: 404,
		meaning:
			"The boundary release you named doesn't contain that area code.",
		fix: "The response's `presentIn` lists the releases that do hold the code.",
	},
	aggregation_not_supported: {
		status: 422,
		meaning:
			"This measure can't be combined that way, like adding up medians or ranks.",
		fix: "Check the measure's `aggregation` with [Get a measure](/docs/v1/reference/data-catalogue/measure), and use individual observations instead.",
	},
	conversion_not_available: {
		status: 422,
		meaning:
			"The crosswalk can't convert this data without dropping, splitting or guessing values.",
		fix: "Try another crosswalk from [List crosswalks](/docs/v1/reference/geography/list-crosswalks), or keep the data on its original areas.",
	},
	partial_coverage: {
		status: 422,
		meaning:
			"Some areas a total needs are missing, so no total is given rather than a quietly incomplete one.",
		fix: "See where the measure is published with [Check a measure's coverage](/docs/v1/reference/data-catalogue/measure-coverage), then choose a period or group of areas it fully covers.",
	},
	ambiguous_place: {
		status: 409,
		meaning: "The name matches several places that have different answers.",
		fix: "Pick one of the `choices` in the response and pass its `place` reference.",
	},
	incompatible_geometry: {
		status: 422,
		meaning:
			"Not every area code in the data appears in the boundary release you chose.",
		fix: "Find a release that fits with [Check which boundaries fit](/docs/v1/reference/data-catalogue/measure-compatibility).",
	},
	invalid_format: {
		status: 400,
		meaning: "This endpoint doesn't offer the `format` you asked for.",
		fix: "Use one of the formats listed for the endpoint's `format` parameter.",
	},
	invalid_cursor: {
		status: 400,
		meaning:
			"The `cursor` wasn't issued by the API, or belongs to a different query.",
		fix: "Start again from the first page, and only pass back the `nextCursor` you were given for the same query.",
	},
	no_release_for_date: {
		status: 404,
		meaning: "No boundary release covers that date (or that country).",
		fix: "The `absence` field says why. Try a later date or drop `country`.",
	},
	ambiguous_release: {
		status: 409,
		meaning:
			"Several releases from the same month could fit, and they differ in more than coverage.",
		fix: "Pick one of the `choices` in the response and use its release id.",
	},
};
