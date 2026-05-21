// lib/utils/mapManager/featureBuilder.ts
import {
	BoundaryGeojson,
	LocalElectionDataset,
	GeneralElectionDataset,
	PopulationDataset,
	HousePriceDataset,
	CrimeDataset,
	PropertyKeys,
	EthnicityDataset,
	Feature,
	Features,
	getFeatureProp,
	BrexitLADDataset,
	BrexitConstituencyDataset,
} from "@lib/types";
import { MapOptions } from "@lib/types/mapOptions";
import {
	calculateMedianAge,
	calculateTotal,
	polygonAreaSqKm,
} from "../population";
import {
	getColorForAge,
	getColorForGenderRatio,
	getColorForDensity,
	getColorForHousePrice,
	getColorForCrimeRate,
	getColorForIncome,
	getColorForBrexitLeave,
	getColorForIMD,
	getColor,
	normalizeValue,
} from "../colorScale";
import { IncomeDataset } from "@/lib/types/income";
import { CustomDataset } from "@/lib/types/custom";
import { IMDDataset } from "@/lib/types/imd";
import { LifeExpectancyDataset } from "@/lib/types/lifeExpectancy";
import { getColorForLifeExpectancy } from "../colorScale";

export const DEFAULT_COLOR = "#cccccc";

export class FeatureBuilder {
	formatBoundaryGeoJson(features: Features): BoundaryGeojson {
		return {
			type: "FeatureCollection",
			crs: { type: "", properties: { name: "" } },
			features,
		};
	}

	private mapFeatures<T extends Record<string, unknown>>(
		features: Features,
		addProperties: (feature: Feature, index: number) => T,
	): Features {
		return features.map((feature, i) => ({
			...feature,
			properties: {
				...feature.properties,
				...addProperties(feature, i),
			},
		}));
	}

	buildElectionWinnerFeatures(
		features: Features,
		codeProp: string,
		getWinner: (code: string) => string,
	): Features {
		return this.mapFeatures(features, (feature) => ({
			winningParty: getWinner(getFeatureProp(feature.properties, codeProp) ?? ""),
		}));
	}

	buildElectionPercentageFeatures(
		features: Features,
		data: LocalElectionDataset["data"] | GeneralElectionDataset["data"],
		partyCode: string,
		codeProp: PropertyKeys,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const locationData = data[getFeatureProp(feature.properties, codeProp) ?? ""];

			let percentage = 0;
			if (locationData?.partyVotes) {
				const partyVotes = locationData.partyVotes[partyCode] ?? 0;
				const totalVotes = Object.values(locationData.partyVotes).reduce<number>(
					(sum, v) => sum + (v ?? 0),
					0,
				);
				percentage = totalVotes > 0 ? (partyVotes / totalVotes) * 100 : 0;
			}

			return { percentage, partyCode };
		});
	}

	buildEthnicityFeatures(
		features: Features,
		dataset: EthnicityDataset,
		codeProp: string,
		options: MapOptions,
	): Features {
		const mode = options.ethnicity?.mode || "majority";

		if (mode === "percentage" && options.ethnicity?.selected) {
			return this.buildEthnicityPercentageFeatures(
				features,
				dataset.data,
				options.ethnicity.selected,
				codeProp,
			);
		}

		// Default to majority mode
		return this.buildEthnicityMajorityFeatures(
			features,
			codeProp,
			dataset.results,
		);
	}

	buildEthnicityMajorityFeatures(
		features: Features,
		codeProp: string,
		results: EthnicityDataset["results"],
	): Features {
		return this.mapFeatures(features, (feature) => {
			const code = getFeatureProp(feature.properties, codeProp) ?? "";
			const majorityCategory = results[code] || "NONE";

			return { majorityCategory };
		});
	}

	buildEthnicityPercentageFeatures(
		features: Features,
		data: EthnicityDataset["data"],
		ethnicity: string,
		codeProp: string,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const code = getFeatureProp(feature.properties, codeProp) ?? "";
			const locationData = data[code] || {};

			let totalPopulation = 0;
			let ethnicityPopulation = 0;
			for (const category of Object.values(locationData)) {
				for (const [eth, data] of Object.entries(category)) {
					if (eth === ethnicity) {
						ethnicityPopulation = data.population || 0;
					}
					totalPopulation += data.population || 0;
				}
			}

			const percentage =
				totalPopulation > 0
					? (ethnicityPopulation / totalPopulation) * 100
					: 0;

			return { percentage, categoryCode: ethnicity };
		});
	}

	buildCustomDatasetFeatures(
		features: Features,
		customDataset: CustomDataset,
		codeProp: PropertyKeys,
		mapOptions: MapOptions
	): Features {
		let minValue: number = Infinity;
		let maxValue: number = -Infinity;
		for (const value of Object.values(customDataset.data)) {
			if (typeof value === 'number') {
				if (value < minValue) minValue = value;
				if (value > maxValue) maxValue = value;
			}
		}

		if (minValue === Infinity) {
			return this.mapFeatures(features, () => ({
				value: undefined,
				color: DEFAULT_COLOR,
			}));
		}

		return this.mapFeatures(features, (feature) => {
			const code = getFeatureProp(feature.properties, codeProp) ?? "";
			const value = customDataset.data[code];

			const normalised = normalizeValue(
				value !== undefined ? value : minValue,
				minValue,
				maxValue
			);

			const color = getColor(
				normalised,
				mapOptions.theme.id
			);

			return { value, color };
		});
	}

	buildAgeFeatures(
		features: Features,
		dataset: PopulationDataset,
		wardCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const wardPopulation =
				dataset.data[getFeatureProp(feature.properties, wardCodeProp) ?? ""];

			const color = wardPopulation
				? getColorForAge(
						calculateMedianAge(wardPopulation) ?? 0,
						mapOptions.ageDistribution,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;

			return { color };
		});
	}

	buildGenderFeatures(
		features: Features,
		dataset: PopulationDataset,
		wardCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const wardPopulation =
				dataset.data[getFeatureProp(feature.properties, wardCodeProp) ?? ""];

			let color = DEFAULT_COLOR;
			if (wardPopulation) {
				const males = calculateTotal(wardPopulation.males);
				const females = calculateTotal(wardPopulation.females);
				const ratio = females > 0 ? (males - females) / females : 0;
				color = getColorForGenderRatio(ratio, mapOptions.gender);
			}

			return { color };
		});
	}

	buildDensityFeatures(
		features: Features,
		dataset: PopulationDataset,
		wardCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const wardPopulation =
				dataset.data[getFeatureProp(feature.properties, wardCodeProp) ?? ""];

			let color = DEFAULT_COLOR;
			if (wardPopulation) {
				const total =
					calculateTotal(wardPopulation.males) +
					calculateTotal(wardPopulation.females);
				const areaSqKm = polygonAreaSqKm(feature.geometry.coordinates);
				const density = areaSqKm > 0 ? total / areaSqKm : 0;
				color = getColorForDensity(
					density,
					mapOptions.populationDensity,
					mapOptions.theme.id,
				);
			}

			return { color };
		});
	}

	buildHousePriceFeatures(
		features: Features,
		dataset: HousePriceDataset,
		wardCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const ward = dataset.data[getFeatureProp(feature.properties, wardCodeProp) ?? ""];

			const color = ward?.prices[2023]
				? getColorForHousePrice(
						ward.prices[2023],
						mapOptions.housePrice,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;

			return { color };
		});
	}

	buildCrimeRateFeatures(
		features: Features,
		dataset: CrimeDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const area = dataset.data[getFeatureProp(feature.properties, ladCodeProp) ?? ""];

			const color = area
				? getColorForCrimeRate(
						area.totalRecordedCrime,
						mapOptions.crime,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;

			return { color };
		});
	}

	buildIncomeFeatures(
		features: Features,
		dataset: IncomeDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const income =
				dataset.data[getFeatureProp(feature.properties, ladCodeProp) ?? ""]?.annual?.median;

			const color = income
				? getColorForIncome(
						income,
						mapOptions.income,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;

			return { color };
		});
	}

	buildBrexitConstituencyFeatures(
		features: Features,
		dataset: BrexitConstituencyDataset,
		constituencyCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const area =
				dataset.data[getFeatureProp(feature.properties, constituencyCodeProp) ?? ""];

			const color = area
				? getColorForBrexitLeave(area.pctLeave, mapOptions.brexitConstituency)
				: DEFAULT_COLOR;

			return { color };
		});
	}

	buildBrexitFeatures(
		features: Features,
		dataset: BrexitLADDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const area =
				dataset.data[getFeatureProp(feature.properties, ladCodeProp) ?? ""];

			const color = area
				? getColorForBrexitLeave(area.pctLeave, mapOptions.brexit)
				: DEFAULT_COLOR;

			return { color };
		});
	}

	buildLifeExpectancyFeatures(
		features: Features,
		dataset: LifeExpectancyDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		const avgs = Object.values(dataset.data).map(
			(r) => (r.maleBirthLE + r.femaleBirthLE) / 2,
		);
		const min = Math.min(...avgs);
		const max = Math.max(...avgs);
		return this.mapFeatures(features, (feature) => {
			const area = dataset.data[getFeatureProp(feature.properties, ladCodeProp) ?? ""];
			const avgLE = area ? (area.maleBirthLE + area.femaleBirthLE) / 2 : null;
			const color = avgLE !== null
				? getColorForLifeExpectancy(avgLE, min, max, mapOptions.theme.id)
				: DEFAULT_COLOR;
			return { color };
		});
	}

	buildIMDFeatures(
		features: Features,
		dataset: IMDDataset,
		lsoaCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const code = getFeatureProp(feature.properties, lsoaCodeProp) ?? "";
			const area = dataset.data[code];
			const color = area
				? getColorForIMD(area.imdScore, mapOptions.imd, mapOptions.theme.id)
				: DEFAULT_COLOR;
			return { color };
		});
	}
}
