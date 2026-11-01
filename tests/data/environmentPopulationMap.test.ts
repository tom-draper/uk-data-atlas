import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { addPopulationMetrics } from "@uk-data-atlas/datasets/data/population/metrics";
import { electricityConsumptionDefinition } from "@/lib/datasets/electricityConsumption";
import { gasConsumptionDefinition } from "@/lib/datasets/gasConsumption";
import { wasteDefinition } from "@/lib/datasets/waste";
import type {
	ElectricityConsumptionDataset,
	GasConsumptionDataset,
} from "@uk-data-atlas/datasets/types/energyConsumption";
import type { IndicatorDataset } from "@uk-data-atlas/datasets/types/indicator";

const electricity: ElectricityConsumptionDataset = {
	id: "electricityConsumption2024",
	type: "electricityConsumption",
	year: 2024,
	boundaryType: "localAuthority",
	boundaryYear: 2025,
	data: {
		E1: {
			ladCode: "E1",
			ladName: "Example",
			allMetersGwh: 100,
			domesticGwh: 40,
			nonDomesticGwh: 60,
			metersThousands: 25,
			metrics: { per100kPopulation: 200 },
		},
	},
};
const gas: GasConsumptionDataset = {
	...electricity,
	id: "gasConsumption2024",
	type: "gasConsumption",
};
const waste: IndicatorDataset<"waste"> = {
	id: "waste2025",
	type: "waste",
	year: 2025,
	boundaryType: "localAuthority",
	boundaryYear: 2025,
	data: {
		E1: {
			code: "E1",
			name: "Example",
			value: 100,
			metrics: { per100kPopulation: 200 },
		},
		E2: { code: "E2", name: "Missing population", value: 50 },
	},
};
const perPopulation = {
	...DEFAULT_MAP_OPTIONS,
	electricityConsumption: {
		...DEFAULT_MAP_OPTIONS.electricityConsumption,
		measure: "perPopulation",
	},
	gasConsumption: {
		...DEFAULT_MAP_OPTIONS.gasConsumption,
		measure: "perPopulation",
	},
	waste: { ...DEFAULT_MAP_OPTIONS.waste, measure: "perPopulation" },
} satisfies typeof DEFAULT_MAP_OPTIONS;

describe("environment population metrics", () => {
	it("calculates rates from all resident ages and preserves published metrics", () => {
		const records = {
			E1: { value: 100, metrics: { recycledTonnes: 25 } },
			E2: { value: 50, metrics: {} },
		};
		addPopulationMetrics(
			records,
			{
				E1: {
					ladName: "Example",
					total: { "0": 20_000, "1": 30_000 },
					males: {},
					females: {},
				},
			},
			(record) => record.value,
		);
		expect(records.E1.metrics).toEqual({
			recycledTonnes: 25,
			per100kPopulation: 200,
		});
		expect(records.E2.metrics).toEqual({});
	});
	it("switches electricity map values and legend units", () => {
		const map = electricityConsumptionDefinition.map!;
		expect(map.valueFor?.(electricity, "E1", DEFAULT_MAP_OPTIONS)).toBe(
			100,
		);
		expect(map.valueFor?.(electricity, "E1", perPopulation)).toBe(200);
		expect(map.legend.format(200, perPopulation)).toBe("200 GWh per 100k");
		expect(map.sourceMode?.(electricity, perPopulation)).not.toBe(
			map.sourceMode?.(electricity, DEFAULT_MAP_OPTIONS),
		);
	});
	it("switches gas map values and legend units", () => {
		const map = gasConsumptionDefinition.map!;
		expect(map.valueFor?.(gas, "E1", DEFAULT_MAP_OPTIONS)).toBe(100);
		expect(map.valueFor?.(gas, "E1", perPopulation)).toBe(200);
		expect(map.legend.format(200, perPopulation)).toBe("200 GWh per 100k");
	});
	it("switches waste map values without turning missing populations into zero", () => {
		const map = wasteDefinition.map!;
		expect(map.valueFor?.(waste, "E1", DEFAULT_MAP_OPTIONS)).toBe(100);
		expect(map.valueFor?.(waste, "E1", perPopulation)).toBe(200);
		expect(map.valueFor?.(waste, "E2", DEFAULT_MAP_OPTIONS)).toBe(50);
		expect(map.valueFor?.(waste, "E2", perPopulation)).toBeNull();
		expect(map.legend.format(200, perPopulation)).toBe("200 t per 100k");
	});
});
