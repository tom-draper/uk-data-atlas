/**
 * Metered electricity and gas consumption by local authority, as DESNZ
 * publishes it.
 *
 * These are meter readings reconciled to the settlement systems, not a model:
 * every consuming meter in Great Britain is counted once and assigned to the
 * authority its address falls in. Northern Ireland has its own market and is
 * not covered.
 *
 * Consumption is a total over meters, so it adds up over areas. Mean and
 * median consumption per meter are published too but are deliberately not
 * carried here: they are ratios, and neither sums nor averages over a group of
 * authorities without recomputing from the totals.
 */
export interface EnergyConsumptionLADData {
	ladCode: string;
	ladName: string;
	/** Consumption on domestic meters, in GWh. */
	domesticGwh: number;
	/** Consumption on non-domestic meters, in GWh. */
	nonDomesticGwh: number;
	/** Every meter, in GWh. Equals the two above exactly, as published. */
	allMetersGwh: number;
	/** Meters counted, in thousands. */
	metersThousands: number;
}

interface EnergyConsumptionDataset<Type extends string> {
	id: string;
	type: Type;
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, EnergyConsumptionLADData>;
}

export type ElectricityConsumptionDataset =
	EnergyConsumptionDataset<"electricityConsumption">;
export type GasConsumptionDataset = EnergyConsumptionDataset<"gasConsumption">;
