import type { MobileCoverageDataset } from "../../types/mobileCoverage.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { PREMISES, measure } from "../../declaration/measures.ts";
import { aggregateMobileCoverage } from "./aggregate.ts";
import { loadMobileCoverage } from "./loader.ts";

const WEIGHT = {
	kind: "weighted-mean",
	weight: {
		description:
			"The authority's premises count, which the published coverage percentages are computed against.",
		datasetField: "premisesCount",
	},
} as const;

export const mobileCoverage = defineDataset<MobileCoverageDataset>({
	id: "mobile-coverage",
	module: "infrastructure",
	source: {
		name: "Mobile Coverage",
		publisher: "Ofcom",
		sourceUrl:
			"https://www.ofcom.org.uk/phones-and-broadband/coverage-and-speeds/connected-nations-20252/data-downloads-2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Ofcom. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"4G and 5G coverage by local authority district across the UK, reported as the share of premises and landmass reached by all four mobile operators and by at least one.",
		year: "2025",
		cadence: "annual",
		notes: [
			"This is a share of premises, so it does not add over areas. Combining authorities needs a premises-weighted mean, and the weight is not served here; averaging the percentages flat would weigh the Isles of Scilly as heavily as Birmingham.",
		],
	},
	boundary: { type: "localAuthority", year: 2024 },
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
	ingestion: {
		minimumDataRecords: 361,
		expectedBoundaryYears: [2024],
		requiredDataFields: ["pct4GIndoorAll", "pct5GOutdoorAll"],
	},
	load: ({ text }) => loadMobileCoverage(text),
	statistics: {
		payload: {
			header: {
				coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
			},
			code: "ladCode",
		},
		name: "ladName",
		measures: [
			PREMISES,
			measure(
				"mobile-premises-coverage",
				"Mobile coverage of premises",
				"percent of premises",
				"share",
				"weighted_mean",
				"Premises with mobile coverage, as a percentage of premises.",
				{ weight: PREMISES.slug },
			),
			measure(
				"mobile-area-coverage",
				"Mobile coverage of land",
				"percent of area",
				"share",
				"weighted_mean",
				"Land area with outdoor mobile coverage, as a percentage of the area.",
			),
		],
		dimensions: [
			{
				slug: "mobile-technology",
				label: "Mobile technology",
				members: [
					{ key: "4g", label: "4G" },
					{ key: "5g", label: "5G" },
				],
			},
			{
				slug: "coverage-location",
				label: "Coverage location",
				members: [
					{ key: "indoor", label: "Indoors" },
					{ key: "outdoor", label: "Outdoors" },
				],
			},
			{
				slug: "mobile-operators",
				label: "Mobile operators",
				members: [
					{ key: "all", label: "All four operators" },
					{ key: "any", label: "At least one operator" },
				],
			},
		],
		fields: [
			...[
				[
					"pct4GIndoorAll",
					"mobile-premises-coverage",
					"4g",
					"indoor",
					"all",
				],
				[
					"pct4GIndoorAny",
					"mobile-premises-coverage",
					"4g",
					"indoor",
					"any",
				],
				[
					"pct5GOutdoorAll",
					"mobile-premises-coverage",
					"5g",
					"outdoor",
					"all",
				],
				[
					"pct5GOutdoorAny",
					"mobile-premises-coverage",
					"5g",
					"outdoor",
					"any",
				],
				["pct4GGeoAll", "mobile-area-coverage", "4g", "outdoor", "all"],
				["pct5GGeoAny", "mobile-area-coverage", "5g", "outdoor", "any"],
			].map(([path, measure, technology, location, operators]) => ({
				path,
				measure,
				members: {
					"mobile-technology": technology,
					"coverage-location": location,
					"mobile-operators": operators,
				},
			})),
			{ path: "premisesCount", measure: "premises" },
		],
	},
	/**
	 * Two of the six published coverage metrics. The "at least one operator"
	 * variants sit between 94% and 100% for indoor 4G and are nearly saturated,
	 * so they distinguish almost nothing; the landmass variants use a different
	 * denominator and so cannot be weighted by premises. Both remain in the
	 * compiled dataset for anyone reading it directly.
	 */
	catalogue: {
		kind: "indicators",
		yearly: true,
		coverageNote:
			"Published source records cover all four UK nations for the single available period.",
		indicators: [
			{
				id: "mobile-4g-coverage",
				label: "4G mobile coverage",
				field: "pct4GIndoorAll",
				valueKind: "ratio",
				unit: "% of premises",
				aggregation: WEIGHT,
				notes: [
					"Premises with an indoor 4G signal from all four mobile network operators. Indoor coverage is modelled by the publisher, not measured at each premises.",
				],
				measure: "mobile-premises-coverage",
				members: {
					"mobile-technology": "4g",
					"coverage-location": "indoor",
					"mobile-operators": "all",
				},
			},
			{
				id: "mobile-5g-coverage",
				label: "5G mobile coverage",
				field: "pct5GOutdoorAll",
				valueKind: "ratio",
				unit: "% of premises",
				aggregation: WEIGHT,
				notes: [
					"Premises with an outdoor 5G signal from all four mobile network operators, at the publisher's high-confidence threshold. 5G is reported outdoors only.",
				],
				measure: "mobile-premises-coverage",
				members: {
					"mobile-technology": "5g",
					"coverage-location": "outdoor",
					"mobile-operators": "all",
				},
			},
		],
	},
	display: {
		group: "Telecoms",
		label: "Mobile Coverage [2025]",
		defaultVisible: true,
		year: 2025,
		component: "@/components/telecoms/mobile/MobileCoverageChart",
		measures: [
			{
				id: "pct5GOutdoorAll",
				label: "5G outdoors, all four operators",
				field: "pct5GOutdoorAll",
				colorRange: { min: 5, max: 75 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: "% 5G outdoors, all four operators",
					},
				},
			},
			{
				id: "pct5GOutdoorAny",
				label: "5G outdoors, any operator",
				field: "pct5GOutdoorAny",
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: "% 5G outdoors, any operator",
					},
				},
			},
			{
				id: "pct4GIndoorAll",
				label: "4G indoors, all four operators",
				field: "pct4GIndoorAll",
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: "% 4G indoors, all four operators",
					},
				},
			},
			{
				id: "pct4GIndoorAny",
				label: "4G indoors, any operator",
				field: "pct4GIndoorAny",
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: "% 4G indoors, any operator",
					},
				},
			},
			{
				id: "pct4GGeoAll",
				label: "4G landmass, all four operators",
				field: "pct4GGeoAll",
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: "% 4G landmass, all four operators",
					},
				},
			},
			{
				id: "pct5GGeoAny",
				label: "5G landmass, any operator",
				field: "pct5GGeoAny",
				colorRange: { min: 0, max: 100 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: "% 5G landmass, any operator",
					},
				},
			},
		],
		aggregation: {
			scope: "localAuthority",
			aggregate: aggregateMobileCoverage,
		},
	},
});
