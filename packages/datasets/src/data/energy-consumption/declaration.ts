import type { EnergyConsumptionLADData } from "../../types/energyConsumption.ts";
import type { DatasetReader } from "../catalog/types.ts";
import type { DeclaredStatistics } from "../../declaration/dataset.ts";
import type {
	DatasetDisplay,
	DisplayMeasure,
} from "../../declaration/display.ts";
import { measure, per100k } from "../../declaration/measures.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import { addPopulationMetrics } from "../population/metrics.ts";
import { loadPopulationUk } from "../population/ukLoader.ts";
import { aggregateEnergyConsumption } from "./aggregate.ts";

/**
 * Electricity and gas are published as two datasets of one shape: metered
 * gigawatt hours on domestic and non-domestic meters for each authority. What
 * differs is the fuel, its source text and the scale of its map, so the shared
 * parts are written once here.
 */

const COVERAGE = ["GB-ENG", "GB-WLS", "GB-SCT"] as const;

type Fuel = "electricity" | "gas";

const METER_TYPE = {
	slug: "meter-type",
	label: "Meter type",
	members: [
		{ key: "allMetersGwh", code: "all", label: "All meters" },
		{
			key: "domesticGwh",
			code: "domestic",
			label: "Domestic",
			parent: "allMetersGwh",
		},
		{
			key: "nonDomesticGwh",
			code: "non-domestic",
			label: "Non-domestic",
			parent: "allMetersGwh",
		},
	],
};

export const energyStatistics = (
	fuel: Fuel,
	id: `${Fuel}-consumption`,
): DeclaredStatistics => {
	const label = fuel === "gas" ? "Gas" : "Electricity";
	return {
		payload: {
			parts: yearParts(id, "localAuthority", 2025, {
				coverageCountries: [...COVERAGE],
			}),
			code: "ladCode",
		},
		name: "ladName",
		measures: [
			measure(
				`${fuel}-consumption`,
				`${label} consumption`,
				"gwh",
				"amount",
				"sum",
				`Metered ${fuel} consumption in gigawatt hours.`,
			),
			measure(
				`${fuel}-meters`,
				`${label} meters`,
				"thousand meters",
				"count",
				"sum",
				`${label} meters, in thousands.`,
			),
		],
		dimensions: [METER_TYPE],
		fields: [
			{ path: "{meter-type}", measure: `${fuel}-consumption` },
			{ path: "metersThousands", measure: `${fuel}-meters` },
		],
		...per100k((record) => record.allMetersGwh),
	};
};

/** Reads the consumption files, then gives each authority its rate per 100,000 residents. */
export const loadWithPopulation =
	<
		T extends {
			year: number;
			data: Record<string, EnergyConsumptionLADData>;
		},
	>(
		loadFuel: (text: DatasetReader["text"]) => Promise<Record<string, T>>,
	) =>
	async ({ text, xlsxSheet }: DatasetReader) => {
		const datasets = await loadFuel(text);
		const population = await loadPopulationUk(xlsxSheet);
		for (const dataset of Object.values(datasets)) {
			addPopulationMetrics(
				dataset.data,
				population[dataset.year]?.data ?? {},
				(record) => record.allMetersGwh,
			);
		}
		return datasets;
	};

const SECTORS = [
	{ id: "all", label: "All meters", field: "allMetersGwh" },
	{ id: "domestic", label: "Domestic meters", field: "domesticGwh" },
	{
		id: "non-domestic",
		label: "Non-domestic meters",
		field: "nonDomesticGwh",
	},
] as const;

/**
 * One map measure for each meter type, as a total and as a rate per 100,000
 * residents. The rate is the whole area's rate shared out by the meter type's
 * part of the consumption. The card always shows the total, because an
 * aggregate of several authorities has no single rate.
 */
export const energyDisplay = ({
	fuel,
	label,
	year,
	source,
	totalRange,
	rateRange,
	legendMax,
}: {
	fuel: Fuel;
	label: string;
	year: number;
	source: string;
	totalRange: number;
	rateRange: number;
	legendMax: number;
}): DatasetDisplay => {
	const measures = (["total", "rate"] as const).flatMap((basis) =>
		SECTORS.map(({ id, label: sector, field }): DisplayMeasure => ({
			id: basis === "total" ? id : `${id}-per-100k`,
			label:
				basis === "total"
					? sector.replace(" meters", "")
					: `${sector.replace(" meters", "")} per 100k`,
			field:
				basis === "total"
					? field
					: {
							apportion: {
								amount: "metrics.per100kPopulation",
								part: field,
								whole: "allMetersGwh",
							},
						},
			colorRange: {
				min: 0,
				max: basis === "total" ? totalRange : rateRange,
			},
			legend: {
				min: 0,
				max: legendMax,
				format: {
					kind: "compact",
					suffix: basis === "total" ? " GWh" : " GWh per 100k",
				},
			},
			card: {
				unit: "GWh",
				format: { kind: "compact" },
				maximum: legendMax,
				field,
				note: `${sector} total`,
			},
		})),
	);
	return {
		label,
		year,
		card: {
			heading: `${fuel === "gas" ? "Gas" : "Electricity"} consumption`,
			coverage: "Great Britain",
			source,
		},
		measures: measures as unknown as DatasetDisplay["measures"],
		aggregation: {
			scope: "localAuthority",
			aggregate: aggregateEnergyConsumption,
		},
	};
};
