import { crimeDatasetDefinition } from "@/lib/data/catalog/definitions";
import { crimeAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type { AggregatedCrimeData, CrimeDataset } from "@/lib/types/crime";
import { formatCount } from "@/lib/helpers/formatCount";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";

export const crimeDefinition: ChartDatasetDefinition<CrimeDataset> = {
	...crimeDatasetDefinition,
	chart: {
		group: "Economics",
		key: "economics-crime",
		label: "Crime Rate [2026]",
		defaultVisible: true,
		componentPath: "@/components/ValueCard",
		card: defineValueCard<
			CrimeDataset,
			{ totalRecordedCrime: number },
			AggregatedCrimeData
		>({
			heading: "Recorded Crime",
			coverage: "England & Wales",
			source: "Home Office. Police Recorded Crime Open Data Tables. data.police.uk",
			unit: "offences",
			format: (value) => formatCount(Math.round(value)),
			// A total above 100,000 offences fills the bar; lower totals stay
			// proportional so small authorities are not flattened to zero.
			maximum: 100_000,
			// With no area selected the card shows the mean authority total.
			aggregate: (aggregate) => ({
				totalRecordedCrime: aggregate.averageRecordedCrime,
			}),
			// A zero total means the table did not attribute the authority.
			value: (stats) => stats.totalRecordedCrime || null,
		}),
		calculateStats: (m, g, d, l, id) =>
			m.aggregate(crimeAggregation, g, d, l, id),
		year: 2026,
	},
	map: {
		valueKey: "totalRecordedCrime",
		colorRange: { min: 10000, max: 100000 },
		legend: { min: 0, max: 150000, format: (v) => v.toFixed(0) },
	},
};
