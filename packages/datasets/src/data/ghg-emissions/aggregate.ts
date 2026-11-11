import type {
	AggregatedGhgEmissionsData,
	GhgEmissionsLADData,
} from "../../types/ghgEmissions.ts";

/**
 * Emissions are a count, so they add across authorities; the per-person figure
 * has to be recomputed from the summed population rather than averaged, or a
 * rural authority with few residents would weigh as heavily as a city.
 */
export function aggregateGhgEmissions(
	records: GhgEmissionsLADData[],
): AggregatedGhgEmissionsData | null {
	const sectors = {
		commercial: 0,
		publicSector: 0,
		agriculture: 0,
		waste: 0,
		landUse: 0,
	};
	let totalKtCO2e = 0,
		excludingLandUseKtCO2e = 0,
		populationThousands = 0,
		transport = 0,
		domestic = 0,
		industry = 0,
		count = 0;
	for (const record of records) {
		totalKtCO2e += record.totalKtCO2e;
		sectors.commercial += record.commercial;
		sectors.publicSector += record.publicSector;
		sectors.agriculture += record.agriculture;
		sectors.waste += record.waste;
		sectors.landUse += record.landUse;

		excludingLandUseKtCO2e += record.excludingLandUseKtCO2e;
		populationThousands += record.populationThousands;
		transport += record.transport;
		domestic += record.domestic;
		industry += record.industry;
		count++;
	}
	return count === 0
		? null
		: {
				totalKtCO2e,
				excludingLandUseKtCO2e,
				perPersonTCO2e:
					populationThousands > 0
						? totalKtCO2e / populationThousands
						: 0,
				transport,
				domestic,
				industry,
				...sectors,
			};
}
