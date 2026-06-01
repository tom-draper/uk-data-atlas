// lib/utils/mapManager/featureBuilder.ts
import {
	BoundaryGeojson,
	PropertyKeys,
	Feature,
	Features,
	getFeatureProp,
} from "@lib/types/geometry";
import { LocalElectionDataset, GeneralElectionDataset } from "@lib/types/elections";
import { PopulationDataset } from "@lib/types/population";
import { HousePriceDataset } from "@lib/types/housePrice";
import { CrimeDataset } from "@lib/types/crime";
import { EthnicityDataset } from "@lib/types/ethnicity";
import { BrexitLADDataset, BrexitConstituencyDataset } from "@lib/types/referendum";
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
	getColorForSIMD,
	getColorForWIMD,
	getColorForNIMDM,
	getColorForBroadband,
	getColorForAirQuality,
} from "../colorScale/datasetColors";
import { getColor } from "../colorScale/themes";
import { normalizeValue } from "../colorScale/interpolation";
import { IncomeDataset } from "@/lib/types/income";
import { CustomDataset } from "@/lib/types/custom";
import { IMDDataset } from "@/lib/types/imd";
import { SIMDDataset } from "@/lib/types/simd";
import { WIMDDataset } from "@/lib/types/wimd";
import { NIMDMDataset } from "@/lib/types/nimdm";
import { LifeExpectancyDataset } from "@/lib/types/lifeExpectancy";
import { QualificationDataset } from "@/lib/types/qualification";
import { BroadbandDataset } from "@/lib/types/broadband";
import { AirQualityDataset } from "@/lib/types/airQuality";
import {
	getColorForLifeExpectancy,
	getColorForQualification,
} from "../colorScale/datasetColors";

export const DEFAULT_COLOR = "#cccccc";

// Cache computed area per feature geometry — avoids re-traversing polygon vertices across dataset switches
const featureAreaCache = new WeakMap<object, number>();

function getCachedArea(feature: Feature): number {
	const geom = feature.geometry.coordinates as object;
	let area = featureAreaCache.get(geom);
	if (area === undefined) {
		area = polygonAreaSqKm(feature.geometry.coordinates);
		featureAreaCache.set(geom, area);
	}
	return area;
}

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
			winningParty: getWinner(
				getFeatureProp(feature.properties, codeProp) ?? "",
			),
		}));
	}

	buildElectionPercentageFeatures(
		features: Features,
		data: LocalElectionDataset["data"] | GeneralElectionDataset["data"],
		partyCode: string,
		codeProp: PropertyKeys,
	): Features {
		const totalVotesMap = new Map<string, number>();
		for (const [code, loc] of Object.entries(data)) {
			if (loc?.partyVotes) {
				let total = 0;
				for (const v of Object.values(loc.partyVotes)) total += (v as number) ?? 0;
				totalVotesMap.set(code, total);
			}
		}

		return this.mapFeatures(features, (feature) => {
			const code = getFeatureProp(feature.properties, codeProp) ?? "";
			const locationData = data[code];
			let percentage = 0;
			if (locationData?.partyVotes) {
				const partyVotes = locationData.partyVotes[partyCode] ?? 0;
				const totalVotes = totalVotesMap.get(code) ?? 0;
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
		const totals = new Map<string, { total: number; count: number }>();
		for (const [code, locationData] of Object.entries(data)) {
			let total = 0;
			let count = 0;
			for (const category of Object.values(locationData)) {
				for (const [eth, d] of Object.entries(category)) {
					total += d.population || 0;
					if (eth === ethnicity) count = d.population || 0;
				}
			}
			totals.set(code, { total, count });
		}

		return this.mapFeatures(features, (feature) => {
			const code = getFeatureProp(feature.properties, codeProp) ?? "";
			const { total = 0, count = 0 } = totals.get(code) ?? {};
			const percentage = total > 0 ? (count / total) * 100 : 0;
			return { percentage, categoryCode: ethnicity };
		});
	}

	buildCustomDatasetFeatures(
		features: Features,
		customDataset: CustomDataset,
		codeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		let minValue: number = Infinity;
		let maxValue: number = -Infinity;
		for (const value of Object.values(customDataset.data)) {
			if (typeof value === "number") {
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
				maxValue,
			);

			const color = getColor(normalised, mapOptions.theme.id);

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
				dataset.data[
					getFeatureProp(feature.properties, wardCodeProp) ?? ""
				];

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
				dataset.data[
					getFeatureProp(feature.properties, wardCodeProp) ?? ""
				];

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
				dataset.data[
					getFeatureProp(feature.properties, wardCodeProp) ?? ""
				];

			let color = DEFAULT_COLOR;
			if (wardPopulation) {
				const total =
					calculateTotal(wardPopulation.males) +
					calculateTotal(wardPopulation.females);
				const areaSqKm = getCachedArea(feature);
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
			const ward =
				dataset.data[
					getFeatureProp(feature.properties, wardCodeProp) ?? ""
				];

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
			const area =
				dataset.data[
					getFeatureProp(feature.properties, ladCodeProp) ?? ""
				];

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
				dataset.data[
					getFeatureProp(feature.properties, ladCodeProp) ?? ""
				]?.annual?.median;

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
				dataset.data[
					getFeatureProp(feature.properties, constituencyCodeProp) ??
						""
				];

			const color = area
				? getColorForBrexitLeave(
						area.pctLeave,
						mapOptions.brexitConstituency,
					)
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
				dataset.data[
					getFeatureProp(feature.properties, ladCodeProp) ?? ""
				];

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
		let min = Infinity;
		let max = -Infinity;
		for (const r of Object.values(dataset.data)) {
			const avg = (r.maleBirthLE + r.femaleBirthLE) / 2;
			if (avg < min) min = avg;
			if (avg > max) max = avg;
		}
		return this.mapFeatures(features, (feature) => {
			const area =
				dataset.data[
					getFeatureProp(feature.properties, ladCodeProp) ?? ""
				];
			const avgLE = area
				? (area.maleBirthLE + area.femaleBirthLE) / 2
				: null;
			const color =
				avgLE !== null
					? getColorForLifeExpectancy(
							avgLE,
							min,
							max,
							mapOptions.theme.id,
						)
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
				? getColorForIMD(
						area.imdScore,
						mapOptions.imd,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;
			return { color };
		});
	}

	buildSIMDFeatures(
		features: Features,
		dataset: SIMDDataset,
		dzCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const code = getFeatureProp(feature.properties, dzCodeProp) ?? "";
			const area = dataset.data[code];
			const color = area
				? getColorForSIMD(
						area.simdRank,
						mapOptions.simd,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;
			return { color };
		});
	}

	buildWIMDFeatures(
		features: Features,
		dataset: WIMDDataset,
		lsoaCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const code = getFeatureProp(feature.properties, lsoaCodeProp) ?? "";
			const area = dataset.data[code];
			const color = area
				? getColorForWIMD(
						area.wimdRank,
						mapOptions.wimd,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;
			return { color };
		});
	}

	buildNIMDMFeatures(
		features: Features,
		dataset: NIMDMDataset,
		soaCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const code = getFeatureProp(feature.properties, soaCodeProp) ?? "";
			const area = dataset.data[code];
			const color = area
				? getColorForNIMDM(
						area.nimdmRank,
						mapOptions.nimdm,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;
			return { color };
		});
	}

	buildQualificationFeatures(
		features: Features,
		dataset: QualificationDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const area =
				dataset.data[
					getFeatureProp(feature.properties, ladCodeProp) ?? ""
				];
			const pct =
				area && area.breakdown.total > 0
					? (area.breakdown.level4Plus / area.breakdown.total) * 100
					: null;
			const color =
				pct !== null
					? getColorForQualification(
							pct,
							mapOptions.qualification,
							mapOptions.theme.id,
						)
					: DEFAULT_COLOR;
			return { color };
		});
	}

	buildBroadbandFeatures(
		features: Features,
		dataset: BroadbandDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const pct =
				dataset.data[
					getFeatureProp(feature.properties, ladCodeProp) ?? ""
				]?.pctFullFibre;
			const color = pct != null
				? getColorForBroadband(pct, mapOptions.broadband, mapOptions.theme.id)
				: DEFAULT_COLOR;
			return { color };
		});
	}

	buildAirQualityFeatures(
		features: Features,
		dataset: AirQualityDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const no2 =
				dataset.data[
					getFeatureProp(feature.properties, ladCodeProp) ?? ""
				]?.no2Mean;
			const color = no2 != null
				? getColorForAirQuality(no2, mapOptions.airQuality, mapOptions.theme.id)
				: DEFAULT_COLOR;
			return { color };
		});
	}
}
