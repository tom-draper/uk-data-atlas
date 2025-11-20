// lib/utils/mapManager/featureBuilder.ts
import { BoundaryGeojson, LocalElectionDataset, GeneralElectionDataset, PopulationDataset, HousePriceDataset } from '@lib/types';
import { PopulationOptions, GenderOptions, DensityOptions, HousePriceOptions } from '@lib/types/mapOptions';
import { calculateMedianAge, calculateTotal, polygonAreaSqKm } from '../population';
import { getColorForAge, getColorForGenderRatio, getColorForDensity, getColorForHousePrice } from '../colorScale';

export class FeatureBuilder {
    buildWinnerFeatures(
        features: BoundaryGeojson['features'],
        codeProp: string,
        getWinner: (code: string) => string
    ): BoundaryGeojson {
        return {
            type: 'FeatureCollection',
            features: features.map(feature => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    winningParty: getWinner(feature.properties[codeProp])
                }
            }))
        };
    }

    buildPartyPercentageFeatures(
        features: BoundaryGeojson['features'],
        data: LocalElectionDataset['wardData'] | GeneralElectionDataset['constituencyData'],
        partyCode: string,
        codeProp: string
    ): BoundaryGeojson {
        return {
            type: 'FeatureCollection',
            features: features.map(feature => {
                const code = feature.properties[codeProp];
                const locationData = data[code];
                const partyVotes = locationData?.partyVotes[partyCode] || 0;
                const totalVotes = Object.values(locationData?.partyVotes || {})
                    .reduce((sum, v) => sum + v, 0);
                const percentage = totalVotes > 0 ? (partyVotes / totalVotes) * 100 : 0;

                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        percentage,
                        partyCode
                    }
                };
            })
        };
    }

    buildAgeFeatures(
        geojson: BoundaryGeojson,
        dataset: PopulationDataset,
        wardCodeProp: string,
        mapOptions: PopulationOptions,
        themeId: string = 'viridis'
    ): BoundaryGeojson {
        return {
            type: 'FeatureCollection',
            features: geojson.features.map(feature => {
                const wardCode = feature.properties[wardCodeProp];
                const wardPopulation = dataset.populationData[wardCode];

                if (!wardPopulation) {
                    return { ...feature, properties: { ...feature.properties, color: '#cccccc' } };
                }

                const medianAge = calculateMedianAge(wardPopulation);
                const color = getColorForAge(medianAge, mapOptions, themeId);

                return {
                    ...feature,
                    properties: { ...feature.properties, color }
                };
            })
        };
    }

    buildGenderFeatures(
        geojson: BoundaryGeojson,
        dataset: PopulationDataset,
        wardCodeProp: string,
        mapOptions: GenderOptions
    ): BoundaryGeojson {
        return {
            type: 'FeatureCollection',
            features: geojson.features.map(feature => {
                const wardCode = feature.properties[wardCodeProp];
                const wardPopulation = dataset.populationData[wardCode];

                if (!wardPopulation) {
                    return { ...feature, properties: { ...feature.properties, color: '#cccccc' } };
                }

                const males = calculateTotal(wardPopulation.males);
                const females = calculateTotal(wardPopulation.females);
                const ratio = females > 0 ? (males - females) / females : 0;
                const color = getColorForGenderRatio(ratio, mapOptions);

                return {
                    ...feature,
                    properties: { ...feature.properties, color }
                };
            })
        };
    }

    buildDensityFeatures(
        geojson: BoundaryGeojson,
        dataset: PopulationDataset,
        wardCodeProp: string,
        mapOptions: DensityOptions,
        themeId: string = 'viridis'
    ): BoundaryGeojson {
        return {
            type: 'FeatureCollection',
            features: geojson.features.map(feature => {
                const wardCode = feature.properties[wardCodeProp];
                const wardPopulation = dataset.populationData[wardCode];

                if (!wardPopulation) {
                    return { ...feature, properties: { ...feature.properties, color: '#cccccc' } };
                }

                const total = calculateTotal(wardPopulation.males) + calculateTotal(wardPopulation.females);
                const areaSqKm = polygonAreaSqKm(feature.geometry.coordinates);
                const density = areaSqKm > 0 ? total / areaSqKm : 0;
                const color = getColorForDensity(density, mapOptions, themeId);

                return {
                    ...feature,
                    properties: { ...feature.properties, color }
                };
            })
        };
    }

    buildHousePriceFeatures(
        geojson: BoundaryGeojson,
        dataset: HousePriceDataset,
        wardCodeProp: string,
        mapOptions: HousePriceOptions,
        themeId: string = 'viridis'
    ): BoundaryGeojson {
        return {
            type: 'FeatureCollection',
            features: geojson.features.map(feature => {
                const wardCode = feature.properties[wardCodeProp];
                const ward = dataset.wardData[wardCode];

                if (!ward?.prices[2023]) {
                    return { ...feature, properties: { ...feature.properties, color: '#cccccc' } };
                }

                const color = getColorForHousePrice(ward.prices[2023], mapOptions, themeId);

                return {
                    ...feature,
                    properties: { ...feature.properties, color }
                };
            })
        };
    }
}