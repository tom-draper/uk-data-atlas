import type { EnergyConsumptionLADData } from "@uk-data-atlas/datasets/types/energyConsumption";
export const ENERGY_SECTORS = [
	{ value: "allMetersGwh", label: "All meters" },
	{ value: "domesticGwh", label: "Domestic meters" },
	{ value: "nonDomesticGwh", label: "Non-domestic meters" },
] as const;
export type EnergySector = (typeof ENERGY_SECTORS)[number]["value"];
export function energyConsumptionValue(
	record: EnergyConsumptionLADData | undefined,
	sector: EnergySector,
	measure: "total" | "perPopulation",
) {
	if (!record) return null;
	if (measure === "total") return record[sector];
	const totalRate = record.metrics?.per100kPopulation;
	if (totalRate === undefined) return null;
	return record.allMetersGwh > 0
		? (totalRate * record[sector]) / record.allMetersGwh
		: record[sector] === 0
			? 0
			: null;
}
