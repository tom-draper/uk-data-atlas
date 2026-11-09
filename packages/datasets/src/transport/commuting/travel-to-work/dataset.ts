import type { TravelToWorkDataset } from "../../../types/travelToWork.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import {
	CENSUS_LICENCE,
	census2021,
	districts2021,
} from "../../../data/census/districts.ts";
import { aggregateTravelToWork } from "../../../data/travel-to-work/aggregate.ts";
import { travelToWorkStatisticsParts } from "../../../data/travel-to-work/source.ts";

export const travelToWork = defineDataset<TravelToWorkDataset>({
	id: "travel-to-work",
	topic: "commuting",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	related: ["labour-market"],
	source: {
		name: "Travel to Work",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/datasets/TS061/editions/2021/versions/6",
		year: "2021",
		...CENSUS_LICENCE,
		description:
			"How people in employment travel to their place of work, by local authority district for England and Wales (Census 2021). Shares are of people in employment.",
		cadence: "decennial",
		notes: [],
	},
	ingestion: {
		minimumDataRecords: 331,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["ladCode", "breakdown"],
	},
	load: noCompiledPayload<TravelToWorkDataset>(),
	statistics: {
		direct: {
			only: true,
			read: ({ text }) => travelToWorkStatisticsParts(text),
		},
		payload: {
			parts: () => [
				{
					key: "2021",
					header: {
						id: "travel-to-work2021",
						type: "travel-to-work",
						year: 2021,
						boundaryType: "localAuthority",
						boundaryYear: 2025,
						metadata: {
							source: "Office for National Statistics. Census 2021: Method used to travel to workplace, England and Wales. TS061.",
							notes: [
								"England and Wales only. Shares are of people in employment, so those not in employment or aged under 16 are excluded.",
								"Working mainly at or from home is counted as a method of travel, as the census reports it.",
							],
						},
						coverageCountries: ["GB-ENG", "GB-WLS"],
					},
				},
			],
			code: "ladCode",
		},
		...districts2021,
		period: census2021,
		measures: [
			measure(
				"people-in-employment",
				"People in employment",
				"people",
				"count",
				"sum",
				"Usual residents aged 16 and over in employment in the week before the census.",
			),
		],
		dimensions: [
			{
				slug: "travel-method",
				label: "Method of travel to work",
				members: [
					{
						key: "total",
						code: "total",
						label: "All people in employment",
					},
					{
						key: "workFromHome",
						code: "home",
						label: "Work mainly at or from home",
						parent: "total",
					},
					{
						key: "publicTransport",
						code: "public-transport",
						label: "Public transport",
						parent: "total",
					},
					{
						key: "car",
						code: "car",
						label: "Car or van",
						parent: "total",
					},
					{
						key: "taxi",
						code: "taxi",
						label: "Taxi",
						parent: "total",
					},
					{
						key: "motorcycle",
						code: "motorcycle",
						label: "Motorcycle, scooter or moped",
						parent: "total",
					},
					{
						key: "bicycle",
						code: "bicycle",
						label: "Bicycle",
						parent: "total",
					},
					{
						key: "onFoot",
						code: "on-foot",
						label: "On foot",
						parent: "total",
					},
					{
						key: "other",
						code: "other",
						label: "Other method",
						parent: "total",
					},
				],
			},
		],
		fields: [
			{
				path: "breakdown.{travel-method}",
				measure: "people-in-employment",
			},
		],
	},
	ranking: {
		format: { kind: "decimal", digits: 1, suffix: "%" },
	},
	display: {
		label: "Travel to Work [2021]",
		year: 2021,
		component: "@/components/measures/MeasureBreakdownChart",
		breakdown: {
			heading: "Travel to Work",
			period: "2021",
			source: "Office for National Statistics. Census 2021: Method used to travel to workplace, England and Wales. TS061.",
			coverage: "England & Wales",
			measure: "people-in-employment",
			dimension: "travel-method",
			total: "total",
			parts: [
				{ code: "car", color: "#ef4444", label: "Car or van" },
				{ code: "home", color: "#3b82f6", label: "Work from home" },
				{
					code: "public-transport",
					color: "#8b5cf6",
					label: "Public transport",
				},
				{ code: "on-foot", color: "#22c55e", label: "On foot" },
				{ code: "bicycle", color: "#84cc16", label: "Bicycle" },
				{ code: "taxi", color: "#eab308", label: "Taxi" },
				{ code: "motorcycle", color: "#f97316", label: "Motorcycle" },
				{ code: "other", color: "#9ca3af", label: "Other" },
			],
			accent: "car",
		},
		measures: [
			{
				// Car share: the widest spread of any mode, and the one that
				// reads as the urban-rural gradient people expect from a
				// commuting map.
				id: "car",
				label: "Travel to work by car or van",
				field: {
					share: { of: "breakdown.car", over: "breakdown.total" },
				},
				colorRange: { min: 25, max: 70 },
				legend: {
					min: 0,
					max: 80,
					format: { kind: "decimal", digits: 0, suffix: "%" },
				},
			},
		],
		aggregation: {
			scope: "localAuthority",
			distinct: true,
			aggregate: aggregateTravelToWork,
		},
	},
});

export const travelToWorkSeries = () =>
	travelToWork.statistics!.dimensions!.find(
		(dimension) => dimension.slug === "travel-method",
	)!.members!.map(({ code, key }) => {
		const member = code ?? key;
		return {
			id: `travel-to-work-${member}`,
			measure: "people-in-employment",
			dimensions: { "travel-method": member },
		};
	});

