import { describe, it, expect } from "vitest";
import {
	energyConsumptionValue,
	ENERGY_SECTORS,
} from "@/lib/helpers/energyConsumptionMeasures";
const record = {
	ladCode: "E1",
	ladName: "Area",
	allMetersGwh: 100,
	domesticGwh: 40,
	nonDomesticGwh: 60,
	metersThousands: 2,
	metrics: { per100kPopulation: 200 },
};
describe("energy meter groups", () => {
	it("returns each collected total and scales using the same population", () => {
		for (const sector of ENERGY_SECTORS) {
			expect(energyConsumptionValue(record, sector.value, "total")).toBe(
				record[sector.value],
			);
			expect(
				energyConsumptionValue(record, sector.value, "perPopulation"),
			).toBe(record[sector.value] * 2);
		}
	});
	it("preserves absent authorities and population", () => {
		expect(
			energyConsumptionValue(undefined, "domesticGwh", "total"),
		).toBeNull();
		expect(
			energyConsumptionValue(
				{ ...record, metrics: undefined },
				"domesticGwh",
				"perPopulation",
			),
		).toBeNull();
	});
	it("handles zero consumption without division by zero", () => {
		expect(
			energyConsumptionValue(
				{ ...record, allMetersGwh: 0, domesticGwh: 0 },
				"domesticGwh",
				"perPopulation",
			),
		).toBe(0);
	});
});
