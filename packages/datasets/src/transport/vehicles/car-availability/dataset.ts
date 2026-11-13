import type { CarAvailabilityDataset } from "../../../types/carAvailability.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { HOUSEHOLDS } from "../../../declaration/measures.ts";
import {
	CENSUS_LICENCE,
	census2021,
	districts2021,
} from "../../../data/census/districts.ts";
import { aggregateCarAvailability } from "../../../data/car-availability/aggregate.ts";
import { loadCarAvailability } from "../../../data/car-availability/loader.ts";

export const carAvailability = defineDataset<CarAvailabilityDataset>({
	id: "car-availability",
	topic: "vehicles",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-WLS"],
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
	load: ({ text }) => loadCarAvailability(text),
	statistics: {
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
	display: {
		label: "Car Availability [2021]",
		year: 2021,
		component:
			"@/components/datasets/transport/vehicles/car-availability/CarAvailabilityChart",
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
