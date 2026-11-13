import type { TravelToWorkDataset } from "../../../types/travelToWork.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import {
	CENSUS_LICENCE,
	census2021,
	districts2021,
} from "../../../data/census/districts.ts";
import { aggregateTravelToWork } from "../../../data/travel-to-work/aggregate.ts";
import { loadTravelToWork } from "../../../data/travel-to-work/loader.ts";

export const travelToWork = defineDataset<TravelToWorkDataset>({
	id: "travel-to-work",
	topic: "commuting",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
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
	load: ({ text }) => loadTravelToWork(text),
	statistics: {
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
	display: {
		label: "Travel to Work [2021]",
		year: 2021,
		component: "@/components/transport/travel-to-work/TravelToWorkChart",
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
