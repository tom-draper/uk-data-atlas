// lib/utils/mapManager/featureBuilder.ts
import { BoundaryGeojson, LocalElectionDataset, GeneralElectionDataset, PopulationDataset, HousePriceDataset, CrimeDataset, PropertyKeys, EthnicityDataset, Feature, Features } from '@lib/types';
import { MapOptions } from '@lib/types/mapOptions';
import { calculateMedianAge, calculateTotal, polygonAreaSqKm } from '../population';
import { getColorForAge, getColorForGenderRatio, getColorForDensity, getColorForHousePrice, getColorForCrimeRate, getColorForIncome, getColorForEthnicity } from '../colorScale';
import { IncomeDataset } from '@/lib/types/income';

const DEFAULT_COLOR = '#cccccc';

export class FeatureBuilder {
    formatBoundaryGeoJson(features: Features): BoundaryGeojson {
        return {
            type: 'FeatureCollection',
            crs: { type: '', properties: { name: '' } },
            features
        };
    }

    private mapFeatures<T extends Record<string, any>>(
        features: Features,
        addProperties: (feature: Feature, index: number) => T
    ): Features {
        return features.map((feature, i) => ({
            ...feature,
            properties: {
                ...feature.properties,
                ...addProperties(feature, i)
            }
        }));
    }

    buildWinnerFeatures(
        features: Features,
        codeProp: string,
        getWinner: (code: string) => string
    ): Features {
        return this.mapFeatures(features, (feature) => ({
            winningParty: getWinner(feature.properties[codeProp])
        }));
    }

    buildPartyPercentageFeatures(
        features: Features,
        data: LocalElectionDataset['data'] | GeneralElectionDataset['constituencyData'],
        partyCode: string,
        codeProp: PropertyKeys
    ): Features {
        return this.mapFeatures(features, (feature) => {
            const locationData = data[feature.properties[codeProp]];

            let percentage = 0;
            if (locationData?.partyVotes) {
                const partyVotes = locationData.partyVotes[partyCode] || 0;
                const totalVotes = Object.values(locationData.partyVotes).reduce((sum, v) => sum + v, 0);
                percentage = totalVotes > 0 ? (partyVotes / totalVotes) * 100 : 0;
            }

            return { percentage, partyCode };
        });
    }

    buildAgeFeatures(
        features: Features,
        dataset: PopulationDataset,
        wardCodeProp: PropertyKeys,
        mapOptions: MapOptions
    ): Features {
        return this.mapFeatures(features, (feature) => {
            const wardPopulation = dataset.data[feature.properties[wardCodeProp]];

            const color = wardPopulation
                ? getColorForAge(calculateMedianAge(wardPopulation), mapOptions.ageDistribution, mapOptions.theme.id)
                : DEFAULT_COLOR;

            return { color };
        });
    }

    buildGenderFeatures(
        features: Features,
        dataset: PopulationDataset,
        wardCodeProp: PropertyKeys,
        mapOptions: MapOptions
    ): Features {
        return this.mapFeatures(features, (feature) => {
            const wardPopulation = dataset.data[feature.properties[wardCodeProp]];

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
        mapOptions: MapOptions
    ): Features {
        return this.mapFeatures(features, (feature) => {
            const wardPopulation = dataset.data[feature.properties[wardCodeProp]];

            let color = DEFAULT_COLOR;
            if (wardPopulation) {
                const total = calculateTotal(wardPopulation.males) + calculateTotal(wardPopulation.females);
                const areaSqKm = polygonAreaSqKm(feature.geometry.coordinates);
                const density = areaSqKm > 0 ? total / areaSqKm : 0;
                color = getColorForDensity(density, mapOptions.populationDensity, mapOptions.theme.id);
            }

            return { color };
        });
    }

    buildEthnicityFeatures(
        features: Features,
        dataset: EthnicityDataset,
        ladCodeProp: PropertyKeys,
        mapOptions: MapOptions
    ): Features {
        return this.mapFeatures(features, (feature) => {
            const ethnicityData = dataset.data[feature.properties[ladCodeProp]];

            let color = DEFAULT_COLOR;
            if (ethnicityData) {
                let majorityEthnicity = null;
                let maxCount = 0;

                for (const subcategories of Object.values(ethnicityData)) {
                    for (const ethnicity of Object.values(subcategories)) {
                        if (ethnicity.population > maxCount) {
                            majorityEthnicity = ethnicity.ethnicity;
                            maxCount = ethnicity.population;
                        }
                    }
                }

                if (majorityEthnicity) {
                    color = getColorForEthnicity(majorityEthnicity, mapOptions.income);
                }
            }

            return { color };
        });
    }

    buildHousePriceFeatures(
        features: Features,
        dataset: HousePriceDataset,
        wardCodeProp: PropertyKeys,
        mapOptions: MapOptions
    ): Features {
        return this.mapFeatures(features, (feature) => {
            const ward = dataset.data[feature.properties[wardCodeProp]];

            const color = ward?.prices[2023]
                ? getColorForHousePrice(ward.prices[2023], mapOptions.housePrice, mapOptions.theme.id)
                : DEFAULT_COLOR;

            return { color };
        });
    }

    buildCrimeRateFeatures(
        features: Features,
        dataset: CrimeDataset,
        ladCodeProp: PropertyKeys,
        mapOptions: MapOptions
    ): Features {
        return this.mapFeatures(features, (feature) => {
            const area = dataset.data[feature.properties[ladCodeProp]];

            const color = area
                ? getColorForCrimeRate(area.totalRecordedCrime, mapOptions.crime, mapOptions.theme.id)
                : DEFAULT_COLOR;

            return { color };
        });
    }

    buildIncomeFeatures(
        features: Features,
        dataset: IncomeDataset,
        ladCodeProp: PropertyKeys,
        mapOptions: MapOptions
    ): Features {
        return this.mapFeatures(features, (feature) => {
            const income = dataset.data[feature.properties[ladCodeProp]]?.annual?.median;

            const color = income
                ? getColorForIncome(income, mapOptions.income, mapOptions.theme.id)
                : DEFAULT_COLOR;

            return { color };
        });
    }
}