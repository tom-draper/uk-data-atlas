import { lifeExpectancyAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import { definitionOf, lifeExpectancy } from "@uk-data-atlas/datasets";
import type { LifeExpectancyDataset } from "@uk-data-atlas/datasets";
import type { ChartDatasetDefinition, ChartDefinition } from "./types";

const calculateStats: ChartDefinition<LifeExpectancyDataset>["calculateStats"] =
	(mapManager, geojson, data, location, datasetId) =>
		mapManager.aggregate(
			lifeExpectancyAggregation,
			geojson,
			data,
			location,
			datasetId,
		);

const le: ChartDefinition<LifeExpectancyDataset> = {
	topic: "life-expectancy",
	key: "health-lifeExpectancy",
	label: "Life Expectancy [2022-2024]",
	componentPath:
		"@/components/datasets/health/life-expectancy/life-expectancy/LifeExpectancyChart",
	datasetId: "le",
	keyBy: "id",
	calculateStats,
	year: 2024,
};
export const lifeExpectancyDefinition: ChartDatasetDefinition<LifeExpectancyDataset> =
	{
		...definitionOf(lifeExpectancy),
		chart: le,
		map: {
			valueFor: (dataset, code, mapOptions) => {
				const area = dataset.data[code];
				if (!area) return null;
				switch (mapOptions["life-expectancy"].measure) {
					case "male":
						return area.maleBirthLE;
					case "female":
						return area.femaleBirthLE;
					default:
						return (area.maleBirthLE + area.femaleBirthLE) / 2;
				}
			},
			getColorRange: (dataset, mapOptions) => {
				let min = Infinity;
				let max = -Infinity;
				for (const area of Object.values(dataset.data)) {
					const value =
						mapOptions["life-expectancy"].measure === "male"
							? area.maleBirthLE
							: mapOptions["life-expectancy"].measure === "female"
								? area.femaleBirthLE
								: (area.maleBirthLE + area.femaleBirthLE) / 2;
					min = Math.min(min, value);
					max = Math.max(max, value);
				}
				return { min, max };
			},
			invertColor: false,
			colorRange: { min: 72, max: 84 },
			legend: {
				min: 72,
				max: 84,
				format: (value) => `${value.toFixed(1)}y`,
			},
		},
	};
