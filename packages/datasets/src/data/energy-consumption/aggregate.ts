import type {
	AggregatedEnergyConsumptionData,
	EnergyConsumptionLADData,
} from "../../types/energyConsumption.ts";

/** Metered energy use is a total, so every component adds across authorities. */
export function aggregateEnergyConsumption(
	records: EnergyConsumptionLADData[],
): AggregatedEnergyConsumptionData | null {
	if (records.length === 0) return null;
	return records.reduce<AggregatedEnergyConsumptionData>(
		(total, record) => ({
			domesticGwh: total.domesticGwh + record.domesticGwh,
			nonDomesticGwh: total.nonDomesticGwh + record.nonDomesticGwh,
			allMetersGwh: total.allMetersGwh + record.allMetersGwh,
			metersThousands: total.metersThousands + record.metersThousands,
		}),
		{
			domesticGwh: 0,
			nonDomesticGwh: 0,
			allMetersGwh: 0,
			metersThousands: 0,
		},
	);
}
