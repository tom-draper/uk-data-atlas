// lib/utils/mapManager/featureBuilder.ts
import { BoundaryGeojson, LocalElectionDataset, GeneralElectionDataset, PopulationDataset, HousePriceDataset, CrimeDataset, PropertyKeys } from '@lib/types';
import { MapOptions } from '@lib/types/mapOptions';
import { calculateMedianAge, calculateTotal, polygonAreaSqKm } from '../population';
import { getColorForAge, getColorForGenderRatio, getColorForDensity, getColorForHousePrice, getColorForCrimeRate, getColorForIncome } from '../colorScale';
import { IncomeDataset } from '@/lib/types/income';

const DEFAULT_COLOR = '#cccccc';

export class FeatureBuilder {
    formatBoundaryGeoJson(features: BoundaryGeojson['features']): BoundaryGeojson {
        return {
            type: 'FeatureCollection',
            crs: { type: '', properties: { name: '' } },
            features
        };
    }

    buildWinnerFeatures(
        features: BoundaryGeojson['features'],
        codeProp: string,
        getWinner: (code: string) => string
    ): BoundaryGeojson['features'] {
        // Pre-allocate array for better performance
        const result = new Array(features.length);

        for (let i = 0; i < features.length; i++) {
            const feature = features[i];
            result[i] = {
                ...feature,
                properties: {
                    ...feature.properties,
                    winningParty: getWinner(feature.properties[codeProp])
                }
            };
        }

        return result;
    }

    buildPartyPercentageFeatures(
        features: BoundaryGeojson['features'],
        data: LocalElectionDataset['wardData'] | GeneralElectionDataset['constituencyData'],
        partyCode: string,
        codeProp: PropertyKeys
    ): BoundaryGeojson['features'] {
        const result = new Array(features.length);

        for (let i = 0; i < features.length; i++) {
            const feature = features[i];
            const code = feature.properties[codeProp];
            const locationData = data[code];

            let percentage = 0;
            if (locationData?.partyVotes) {
                const partyVotes = locationData.partyVotes[partyCode] || 0;
                const totalVotes = Object.values(locationData.partyVotes).reduce((sum, v) => sum + v, 0);
                percentage = totalVotes > 0 ? (partyVotes / totalVotes) * 100 : 0;
            }

            result[i] = {
                ...feature,
                properties: {
                    ...feature.properties,
                    percentage,
                    partyCode
                }
            };
        }

        return result;
    }

    // Generic feature builder for colored maps
    private buildColoredFeatures(
        features: BoundaryGeojson['features'],
        codeProp: PropertyKeys,
        getColor: (feature: BoundaryGeojson['features'][0]) => string
    ): BoundaryGeojson['features'] {
        const result = new Array(features.length);

        for (let i = 0; i < features.length; i++) {
            const feature = features[i];
            result[i] = {
                ...feature,
                properties: {
                    ...feature.properties,
                    color: getColor(feature)
                }
            };
        }

        return result;
    }

    buildAgeFeatures(
        features: BoundaryGeojson['features'],
        dataset: PopulationDataset,
        wardCodeProp: PropertyKeys,
        mapOptions: MapOptions
    ): BoundaryGeojson['features'] {
        return this.buildColoredFeatures(features, wardCodeProp, (feature) => {
            const wardCode = feature.properties[wardCodeProp];
            const wardPopulation = dataset.populationData[wardCode];

            if (!wardPopulation) return DEFAULT_COLOR;

            const medianAge = calculateMedianAge(wardPopulation);
            return getColorForAge(medianAge, mapOptions.ageDistribution, mapOptions.general.theme);
        });
    }

    buildGenderFeatures(
        features: BoundaryGeojson['features'],
        dataset: PopulationDataset,
        wardCodeProp: PropertyKeys,
        mapOptions: MapOptions
    ): BoundaryGeojson['features'] {
        return this.buildColoredFeatures(features, wardCodeProp, (feature) => {
            const wardCode = feature.properties[wardCodeProp];
            const wardPopulation = dataset.populationData[wardCode];

            if (!wardPopulation) return DEFAULT_COLOR;

            const males = calculateTotal(wardPopulation.males);
            const females = calculateTotal(wardPopulation.females);
            const ratio = females > 0 ? (males - females) / females : 0;
            return getColorForGenderRatio(ratio, mapOptions.gender);
        });
    }

    buildDensityFeatures(
        features: BoundaryGeojson['features'],
        dataset: PopulationDataset,
        wardCodeProp: PropertyKeys,
        mapOptions: MapOptions
    ): BoundaryGeojson['features'] {
        return this.buildColoredFeatures(features, wardCodeProp, (feature) => {
            const wardCode = feature.properties[wardCodeProp];
            const wardPopulation = dataset.populationData[wardCode];

            if (!wardPopulation) return DEFAULT_COLOR;

            const total = calculateTotal(wardPopulation.males) + calculateTotal(wardPopulation.females);
            const areaSqKm = polygonAreaSqKm(feature.geometry.coordinates);
            const density = areaSqKm > 0 ? total / areaSqKm : 0;
            return getColorForDensity(density, mapOptions.populationDensity, mapOptions.general.theme);
        });
    }

    buildHousePriceFeatures(
        features: BoundaryGeojson['features'],
        dataset: HousePriceDataset,
        wardCodeProp: PropertyKeys,
        mapOptions: MapOptions
    ): BoundaryGeojson['features'] {
        return this.buildColoredFeatures(features, wardCodeProp, (feature) => {
            const wardCode = feature.properties[wardCodeProp];
            const ward = dataset.wardData[wardCode];

            if (!ward?.prices[2023]) return DEFAULT_COLOR;

            return getColorForHousePrice(ward.prices[2023], mapOptions.housePrice, mapOptions.general.theme);
        });
    }

    buildCrimeRateFeatures(
        features: BoundaryGeojson['features'],
        dataset: CrimeDataset,
        ladCodeProp: PropertyKeys,
        mapOptions: MapOptions
    ): BoundaryGeojson['features'] {
        return this.buildColoredFeatures(features, ladCodeProp, (feature) => {
            const ladCode = feature.properties[ladCodeProp];
            const area = dataset.records[ladCode];

            if (!area) return DEFAULT_COLOR;

            return getColorForCrimeRate(area.totalRecordedCrime, mapOptions.crime, mapOptions.general.theme);
        });
    }

    buildIncomeFeatures(
        features: BoundaryGeojson['features'],
        dataset: IncomeDataset,
        ladCodeProp: PropertyKeys,
        mapOptions: MapOptions
    ): BoundaryGeojson['features'] {
        return this.buildColoredFeatures(features, ladCodeProp, (feature) => {
            const ladCode = feature.properties[ladCodeProp];
            const income = dataset.localAuthorityData[ladCode]?.annual?.median;

            if (!income) return DEFAULT_COLOR;

            return getColorForIncome(income, mapOptions.income, mapOptions.general.theme);
        });
    }
}