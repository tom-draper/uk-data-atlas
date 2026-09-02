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
import { IncomeDataset } from "@/lib/types/income";
import { CustomPoint } from "@/lib/types/custom";
import { IMDDataset } from "@/lib/types/imd";
import { SIMDDataset } from "@/lib/types/simd";
import { WIMDDataset } from "@/lib/types/wimd";
import { NIMDMDataset } from "@/lib/types/nimdm";
import { LifeExpectancyDataset } from "@/lib/types/lifeExpectancy";
import { QualificationDataset } from "@/lib/types/qualification";
import { BroadbandDataset } from "@/lib/types/broadband";
import { AirQualityDataset } from "@/lib/types/airQuality";
import { SchoolPerformanceDataset } from "@/lib/types/schoolPerformance";
import { ClaimantCountDataset } from "@/lib/types/claimantCount";
import { NHSWaitingDataset } from "@/lib/types/nhsWaiting";
import { UnemploymentDataset } from "@/lib/types/unemployment";
import {
	getColorForLifeExpectancy,
	getColorForQualification,
	getColorForSchoolPerformance,
	getColorForClaimantCount,
	getColorForNHSWaiting,
	getColorForUnemployment,
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

	// Adds a `color` property to each feature, derived from the area code (and
	// optionally the feature itself). `colorFor` returns DEFAULT_COLOR for areas
	// with no data.
	private buildColorFeatures(
		features: Features,
		codeProp: PropertyKeys,
		colorFor: (code: string, feature: Feature) => string,
	): Features {
		return this.mapFeatures(features, (feature) => ({
			color: colorFor(
				getFeatureProp(feature.properties, codeProp) ?? "",
				feature,
			),
		}));
	}

	// Scalar map datasets keep a stable raw value in the source. Their colour is
	// then calculated by a MapLibre paint expression, avoiding a fresh feature
	// collection whenever a range slider or theme changes.
	buildValueFeatures(
		features: Features,
		codeProp: PropertyKeys,
		valueFor: (code: string, feature: Feature) => number | null | undefined,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const value = valueFor(getFeatureProp(feature.properties, codeProp) ?? "", feature);
			return { value: Number.isFinite(value) ? value : null };
		});
	}

	getFeatureAreaSqKm(feature: Feature): number {
		return getCachedArea(feature);
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
		const excluded = new Set(options.ethnicity?.excluded ?? []);

		if (mode === "percentage" && options.ethnicity?.selected) {
			return this.buildEthnicityPercentageFeatures(
				features,
				dataset.data,
				options.ethnicity.selected,
				codeProp,
			);
		}

		return this.buildEthnicityMajorityFeatures(
			features,
			codeProp,
			dataset.results,
			excluded.size > 0 ? dataset.data : undefined,
			excluded.size > 0 ? excluded : undefined,
		);
	}

	buildEthnicityMajorityFeatures(
		features: Features,
		codeProp: string,
		results: EthnicityDataset["results"],
		data?: EthnicityDataset["data"],
		excluded?: Set<string>,
	): Features {
		return this.mapFeatures(features, (feature) => {
			const code = getFeatureProp(feature.properties, codeProp) ?? "";

			if (excluded && excluded.size > 0 && data) {
				const parentCategories = data[code];
				if (parentCategories) {
					let maxPopulation = 0;
					let majorityCategory = "NONE";
					for (const subcategories of Object.values(parentCategories)) {
						for (const [name, d] of Object.entries(subcategories)) {
							if (!excluded.has(name) && d.population > maxPopulation) {
								maxPopulation = d.population;
								majorityCategory = name;
							}
						}
					}
					return { majorityCategory };
				}
			}

			return { majorityCategory: results[code] || "NONE" };
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

	// Builds a GeoJSON FeatureCollection of points, each coloured by its value
	// against the dataset's value range. Used by the custom point render path.
	buildPointCollection(
		points: CustomPoint[],
		valueMin: number,
		valueMax: number,
		themeId: string,
		colorByValue?: Record<number, string>,
	): GeoJSON.FeatureCollection {
		const range = valueMax - valueMin || 1;
		return {
			type: "FeatureCollection",
			features: points.map((p) => ({
				type: "Feature",
				geometry: { type: "Point", coordinates: [p.lng, p.lat] },
				properties: {
					value: p.value,
					color:
						colorByValue?.[p.value] ??
						getColor((p.value - valueMin) / range, themeId),
					label: p.label ?? "",
					...Object.fromEntries(
						(p.details ?? []).map((detail, index) => [
							`detail${index}`,
							detail,
						]),
					),
				},
			})),
		};
	}

	buildAgeFeatures(
		features: Features,
		dataset: PopulationDataset,
		wardCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, wardCodeProp, (code) => {
			const wardPopulation = dataset.data[code];
			return wardPopulation
				? getColorForAge(
						calculateMedianAge(wardPopulation) ?? 0,
						mapOptions.ageDistribution,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;
		});
	}

	buildGenderFeatures(
		features: Features,
		dataset: PopulationDataset,
		wardCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, wardCodeProp, (code) => {
			const wardPopulation = dataset.data[code];
			if (!wardPopulation) return DEFAULT_COLOR;
			const males = calculateTotal(wardPopulation.males);
			const females = calculateTotal(wardPopulation.females);
			const ratio = females > 0 ? (males - females) / females : 0;
			return getColorForGenderRatio(ratio, mapOptions.gender);
		});
	}

	buildDensityFeatures(
		features: Features,
		dataset: PopulationDataset,
		wardCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, wardCodeProp, (code, feature) => {
			const wardPopulation = dataset.data[code];
			if (!wardPopulation) return DEFAULT_COLOR;
			const total =
				calculateTotal(wardPopulation.males) +
				calculateTotal(wardPopulation.females);
			const areaSqKm = getCachedArea(feature);
			const density = areaSqKm > 0 ? total / areaSqKm : 0;
			return getColorForDensity(
				density,
				mapOptions.populationDensity,
				mapOptions.theme.id,
			);
		});
	}

	buildHousePriceFeatures(
		features: Features,
		dataset: HousePriceDataset,
		wardCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, wardCodeProp, (code) => {
			const ward = dataset.data[code];
			return ward?.prices[2023]
				? getColorForHousePrice(
						ward.prices[2023],
						mapOptions.housePrice,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;
		});
	}

	buildCrimeRateFeatures(
		features: Features,
		dataset: CrimeDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, ladCodeProp, (code) => {
			const area = dataset.data[code];
			return area
				? getColorForCrimeRate(
						area.totalRecordedCrime,
						mapOptions.crime,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;
		});
	}

	buildIncomeFeatures(
		features: Features,
		dataset: IncomeDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, ladCodeProp, (code) => {
			const income = dataset.data[code]?.annual?.median;
			return income
				? getColorForIncome(
						income,
						mapOptions.income,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;
		});
	}

	buildBrexitConstituencyFeatures(
		features: Features,
		dataset: BrexitConstituencyDataset,
		constituencyCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, constituencyCodeProp, (code) => {
			const area = dataset.data[code];
			return area
				? getColorForBrexitLeave(area.pctLeave, mapOptions.brexitConstituency)
				: DEFAULT_COLOR;
		});
	}

	buildBrexitFeatures(
		features: Features,
		dataset: BrexitLADDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, ladCodeProp, (code) => {
			const area = dataset.data[code];
			return area
				? getColorForBrexitLeave(area.pctLeave, mapOptions.brexit)
				: DEFAULT_COLOR;
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
		return this.buildColorFeatures(features, ladCodeProp, (code) => {
			const area = dataset.data[code];
			if (!area) return DEFAULT_COLOR;
			const avgLE = (area.maleBirthLE + area.femaleBirthLE) / 2;
			return getColorForLifeExpectancy(avgLE, min, max, mapOptions.theme.id);
		});
	}

	buildIMDFeatures(
		features: Features,
		dataset: IMDDataset,
		lsoaCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, lsoaCodeProp, (code) => {
			const area = dataset.data[code];
			return area
				? getColorForIMD(
						area.imdScore,
						mapOptions.imd,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;
		});
	}

	buildSIMDFeatures(
		features: Features,
		dataset: SIMDDataset,
		dzCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, dzCodeProp, (code) => {
			const area = dataset.data[code];
			return area
				? getColorForSIMD(
						area.simdRank,
						mapOptions.simd,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;
		});
	}

	buildWIMDFeatures(
		features: Features,
		dataset: WIMDDataset,
		lsoaCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, lsoaCodeProp, (code) => {
			const area = dataset.data[code];
			return area
				? getColorForWIMD(
						area.wimdRank,
						mapOptions.wimd,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;
		});
	}

	buildNIMDMFeatures(
		features: Features,
		dataset: NIMDMDataset,
		soaCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, soaCodeProp, (code) => {
			const area = dataset.data[code];
			return area
				? getColorForNIMDM(
						area.nimdmRank,
						mapOptions.nimdm,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;
		});
	}

	buildQualificationFeatures(
		features: Features,
		dataset: QualificationDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, ladCodeProp, (code) => {
			const area = dataset.data[code];
			const pct =
				area && area.breakdown.total > 0
					? (area.breakdown.level4Plus / area.breakdown.total) * 100
					: null;
			return pct !== null
				? getColorForQualification(
						pct,
						mapOptions.qualification,
						mapOptions.theme.id,
					)
				: DEFAULT_COLOR;
		});
	}

	buildBroadbandFeatures(
		features: Features,
		dataset: BroadbandDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, ladCodeProp, (code) => {
			const pct = dataset.data[code]?.pctFullFibre;
			return pct != null
				? getColorForBroadband(pct, mapOptions.broadband, mapOptions.theme.id)
				: DEFAULT_COLOR;
		});
	}

	buildAirQualityFeatures(
		features: Features,
		dataset: AirQualityDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, ladCodeProp, (code) => {
			const no2 = dataset.data[code]?.no2Mean;
			return no2 != null
				? getColorForAirQuality(no2, mapOptions.airQuality, mapOptions.theme.id)
				: DEFAULT_COLOR;
		});
	}

	buildSchoolPerformanceFeatures(
		features: Features,
		dataset: SchoolPerformanceDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, ladCodeProp, (code) => {
			const pct = dataset.data[code]?.ptL2basics94;
			return pct != null
				? getColorForSchoolPerformance(pct, mapOptions.schoolPerformance, mapOptions.theme.id)
				: DEFAULT_COLOR;
		});
	}

	buildClaimantCountFeatures(
		features: Features,
		dataset: ClaimantCountDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, ladCodeProp, (code) => {
			const rate = dataset.data[code]?.totalRate;
			return rate != null
				? getColorForClaimantCount(rate, mapOptions.claimantCount, mapOptions.theme.id)
				: DEFAULT_COLOR;
		});
	}

	buildUnemploymentFeatures(
		features: Features,
		dataset: UnemploymentDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, ladCodeProp, (code) => {
			const rate = dataset.data[code]?.rates[dataset.latestYear];
			return rate != null
				? getColorForUnemployment(rate, mapOptions.unemployment, mapOptions.theme.id)
				: DEFAULT_COLOR;
		});
	}

	buildNHSWaitingFeatures(
		features: Features,
		dataset: NHSWaitingDataset,
		ladCodeProp: PropertyKeys,
		mapOptions: MapOptions,
	): Features {
		return this.buildColorFeatures(features, ladCodeProp, (code) => {
			const icbCode = dataset.ladToIcb[code];
			const pct = icbCode ? dataset.data[icbCode]?.pctOver18Weeks : undefined;
			return pct != null
				? getColorForNHSWaiting(pct, mapOptions.nhsWaiting, mapOptions.theme.id)
				: DEFAULT_COLOR;
		});
	}
}
