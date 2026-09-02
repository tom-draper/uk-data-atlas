import { loadLE } from "@/lib/data/life-expectancy/loader";
import type { LifeExpectancyDataset } from "@/lib/types/lifeExpectancy";
import type { ChartDatasetDefinition } from "./types";
const le = { group: "Health", key: "health-lifeExpectancy", label: "Life Expectancy [2020-2022]", defaultVisible: true, componentPath: "@/components/health/LifeExpectancyChart", boundaryType: "localAuthority" as const, datasetId: "le", keyBy: "id" as const, calculateStats: (mm: any, g: any, d: any, l: any, id: any) => mm.calculateLifeExpectancyStats(g, d, l, id), year: 2022 };
const hle = { group: "Health", key: "health-healthyLifeExpectancy", label: "Healthy Life Expectancy [2020-2022]", defaultVisible: false, componentPath: "@/components/health/LifeExpectancyChart", boundaryType: "localAuthority" as const, datasetId: "hle", keyBy: "id" as const, calculateStats: (mm: any, g: any, d: any, l: any, id: any) => mm.calculateLifeExpectancyStats(g, d, l, id), year: 2022 };
export const lifeExpectancyDefinition: ChartDatasetDefinition<LifeExpectancyDataset> = {
	type: "lifeExpectancy", precompiledFile: "life-expectancy", chart: le, charts: [le, hle],
	source: { name: "Life Expectancy", source: "Office for National Statistics", sourceUrl: "https://www.ons.gov.uk/peoplepopulationandcommunity/healthandsocialcare/healthandlifeexpectancies/bulletins/lifeexpectancyforlocalareasonenglandandwales/2020to2022", year: "2020-2022", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Life expectancy and healthy life expectancy estimates by local area for England and Wales." },
	map: {
		valueFor: (dataset, code) => {
			const area = dataset.data[code];
			return area ? (area.maleBirthLE + area.femaleBirthLE) / 2 : null;
		},
		getColorRange: (dataset) => {
			let min = Infinity;
			let max = -Infinity;
			for (const area of Object.values(dataset.data)) {
				const value = (area.maleBirthLE + area.femaleBirthLE) / 2;
				min = Math.min(min, value);
				max = Math.max(max, value);
			}
			return { min, max };
		},
		invertColor: false,
		colorRange: { min: 72, max: 84 },
		legend: { min: 72, max: 84, format: String },
	},
	precompile: async ({ text }) => loadLE(text, true),
};
