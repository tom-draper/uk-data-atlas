import type { CarAvailabilityDataset } from "../../../types/carAvailability.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import { HOUSEHOLDS } from "../../../declaration/measures.ts";
import {
	CENSUS_LICENCE,
	census2021,
	districts2021,
} from "../../../data/census/districts.ts";
import { aggregateCarAvailability } from "../../../data/car-availability/aggregate.ts";
import { carAvailabilityStatisticsParts } from "../../../data/car-availability/source.ts";

export const carAvailability = defineDataset<CarAvailabilityDataset>({
	id: "car-availability",
	topic: "vehicles",
	boundary: { type: "localAuthority", year: 2023 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
	guide: {
		title: "Car Availability",
		about: "How many cars or vans households have, from the 2021 Census. The Atlas maps the share of households with no car, which is highest in big cities with good public transport.",
		summary:
			"How many households in each local authority in England and Wales have no car, one, two, or three or more, from Census 2021.",
	},
	mapName: "Car Ownership",
	source: {
		name: "Car Availability",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/datasets/TS045/editions/2021/versions/4",
		year: "2021",
		...CENSUS_LICENCE,
		description:
			"Cars or vans available to each household, by local authority district for England and Wales (Census 2021). Shares are of households.",
		cadence: "decennial",
		notes: [],
	},
	ingestion: {
		minimumDataRecords: 331,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["ladCode", "breakdown"],
	},
	load: noCompiledPayload<CarAvailabilityDataset>(),
	statistics: {
		direct: {
			only: true,
			read: ({ text }) => carAvailabilityStatisticsParts(text),
		},
		payload: {
			parts: () => [
				{
					key: "2021",
					header: {
						id: "car-availability2021",
						type: "car-availability",
						year: 2021,
						boundaryType: "localAuthority",
						boundaryYear: 2025,
						metadata: {
							source: "Office for National Statistics. Census 2021: Car or van availability, England and Wales. TS045.",
							notes: [
								"England and Wales only. Shares are of households, not of people.",
								"The top category is open-ended, so the table gives no vehicle count.",
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
		measures: [HOUSEHOLDS],
		dimensions: [
			{
				slug: "cars-or-vans",
				label: "Cars or vans available",
				members: [
					{ key: "total", code: "total", label: "All households" },
					{
						key: "noCar",
						code: "none",
						label: "No cars or vans",
						parent: "total",
					},
					{
						key: "oneCar",
						code: "one",
						label: "One car or van",
						parent: "total",
					},
					{
						key: "twoCars",
						code: "two",
						label: "Two cars or vans",
						parent: "total",
					},
					{
						key: "threeOrMoreCars",
						code: "three-or-more",
						label: "Three or more cars or vans",
						parent: "total",
					},
				],
			},
		],
		fields: [{ path: "breakdown.{cars-or-vans}", measure: "households" }],
	},
	ranking: {
		label: "Households without a car",
		format: { kind: "decimal", digits: 1, suffix: "%" },
	},
	display: {
		label: "Car Availability [2021]",
		year: 2021,
		component: "@/components/measures/MeasureBreakdownChart",
		breakdown: {
			heading: "Car Availability",
			period: "2021",
			source: "Office for National Statistics. Census 2021: Car or van availability, England and Wales. TS045.",
			coverage: "England & Wales",
			measure: "households",
			dimension: "cars-or-vans",
			total: "total",
			parts: [
				{ code: "none", color: "#3b82f6", label: "No car or van" },
				{ code: "one", color: "#84cc16", label: "1 car or van" },
				{ code: "two", color: "#f97316", label: "2 cars or vans" },
				{ code: "three-or-more", color: "#ef4444", label: "3 or more" },
			],
			accent: "none",
		},
		measures: [
			{
				// Households with no car: the measure with the most spread, and
				// the one that reads as car dependency rather than as affluence.
				id: "no-car",
				label: "Households with no car or van",
				field: {
					share: { of: "breakdown.noCar", over: "breakdown.total" },
				},
				colorRange: { min: 8, max: 50 },
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
			aggregate: aggregateCarAvailability,
		},
	},
});
