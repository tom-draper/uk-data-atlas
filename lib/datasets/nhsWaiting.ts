import { nhsWaitingDatasetDefinition } from "@/lib/data/catalog/definitions";
import { nhsWaitingAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import type {
	AggregatedNHSWaitingData,
	NHSWaitingDataset,
} from "@/lib/types/nhsWaiting";
import type { ChartDatasetDefinition } from "./types";
import { defineValueCard } from "./valueCard";

export const nhsWaitingDefinition: ChartDatasetDefinition<NHSWaitingDataset> = {
	...nhsWaitingDatasetDefinition,
	chart: {
		group: "Health",
		key: "health-nhsWaiting",
		label: "NHS Waiting Times [2026]",
		defaultVisible: true,
		componentPath: "@/components/ValueCard",
		card: defineValueCard<NHSWaitingDataset, AggregatedNHSWaitingData>({
			heading: "NHS Waiting Times",
			coverage: "England",
			source: "NHS England. Referral to Treatment waiting times. england.nhs.uk",
			unit: "% over 18 wks",
			digits: 1,
			// Capped at 50% for visual scale.
			maximum: 50,
			// Waiting times are published by integrated care board.
			lookup: (dataset, code) =>
				dataset.data[dataset.ladToIcb[code] ?? ""],
			value: (stats) => stats.pctOver18Weeks,
			// The 18-week standard: 92% treated within 18 weeks, so at most 8% over.
			secondary: () => "target <8%",
		}),
		calculateStats: (m, g, _d, l, id, dataset) =>
			dataset
				? m.aggregate(nhsWaitingAggregation, g, dataset, l, id)
				: null,
		year: 2026,
	},
	map: {
		valueFor: (dataset, code) => {
			const icbCode = dataset.ladToIcb[code];
			return icbCode
				? (dataset.data[icbCode]?.pctOver18Weeks ?? null)
				: null;
		},
		colorRange: { min: 25, max: 40 },
		legend: { min: 0, max: 100, format: (v) => `${v.toFixed(0)}% >18wks` },
	},
};
