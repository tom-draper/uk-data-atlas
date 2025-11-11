// lib/utils/mapManager.ts
import { PartyVotes, LocalElectionWardData, Party, BoundaryGeojson, ConstituencyData, LocalElectionDataset, GeneralElectionDataset, PopulationDataset, PopulationStats, AgeGroups, ConstituencyStats, WardStats } from '@lib/types';
import { PARTY_COLORS } from '../data/parties';
import { GeoJSONFeature } from 'mapbox-gl';
import { calculateAgeGroups, calculateMedianAge, calculateTotal, polygonAreaSqKm } from './populationHelpers';
import { getWinningParty } from './generalElectionHelpers';
import { GeneralElectionMapOptions, LocalElectionMapOptions } from '../types/mapOptions';
import { getColorForAge, getColorForDensity, getColorForGenderRatio, hexToRgb } from './colorHelpers';

interface MapManagerCallbacks {
    onWardHover?: (params: { data: LocalElectionWardData | null; wardCode: string }) => void;
    onConstituencyHover?: (data: ConstituencyData | null) => void;
    onLocationChange: (location: string) => void;
}

type MapMode = 'local-election' | 'general-election' | 'population';
type PopulationMode = 'age' | 'gender' | 'density';

export class MapManager {
    private map: mapboxgl.Map;
    private callbacks: MapManagerCallbacks;
    private lastHoveredFeatureId: any = null;
    private cache = new Map<string, any>();

    // Constants
    private static readonly SOURCE_ID = 'location-wards';
    private static readonly FILL_LAYER_ID = 'wards-fill';
    private static readonly LINE_LAYER_ID = 'wards-line';
    private static readonly WARD_CODE_KEYS = ['WD24CD', 'WD23CD', 'WD22CD', 'WD21CD'];
    private static readonly CONSTITUENCY_CODE_KEYS = ['PCON24CD', 'PCON25CD', 'pcon19cd', 'PCON17CD', 'PCON15CD'];
    private static readonly PARTY_KEYS = ['LAB', 'CON', 'LD', 'GREEN', 'RUK', 'SNP', 'PC', 'DUP', 'SF', 'OTHER'];

    constructor(map: mapboxgl.Map, callbacks: MapManagerCallbacks) {
        this.map = map;
        this.callbacks = callbacks;
    }

    // ============================================================================
    // Public API - Election Methods
    // ============================================================================

    updateMapForLocalElection(
        geojson: BoundaryGeojson,
        dataset: LocalElectionDataset,
        options?: LocalElectionMapOptions
    ) {
        const wardCodeProp = this.detectPropertyKey(geojson, MapManager.WARD_CODE_KEYS);
        console.log('EXPENSIVE: updateMapForLocalElection: Filtered wards', geojson.features.length);

        const mode = options?.mode || 'winner';
        const locationData = mode === 'party-percentage' && options?.selectedParty
            ? this.buildPartyPercentageFeatures(geojson.features, dataset.wardData, options.selectedParty, wardCodeProp)
            : this.buildWinnerFeatures(geojson.features, wardCodeProp, (code) => dataset.wardResults[code] || 'NONE');

        if (mode === 'party-percentage' && options?.selectedParty) {
            this.updatePartyPercentageLayers(locationData, options.selectedParty);
        } else {
            this.updateElectionLayers(locationData, dataset.partyInfo);
        }

        this.setupEventHandlers('local-election', dataset.wardData, wardCodeProp);
    }

    updateMapForGeneralElection(
        geojson: BoundaryGeojson,
        dataset: GeneralElectionDataset,
        options?: GeneralElectionMapOptions
    ) {
        const constituencyCodeProp = this.detectPropertyKey(geojson, MapManager.CONSTITUENCY_CODE_KEYS);
        console.log('EXPENSIVE: updateMapForGeneralElection: Filtered constituencies:', geojson.features.length);

        const mode = options?.mode || 'winner';
        const locationData = mode === 'party-percentage' && options?.selectedParty
            ? this.buildPartyPercentageFeatures(geojson.features, dataset.constituencyData, options.selectedParty, constituencyCodeProp)
            : this.buildWinnerFeatures(geojson.features, constituencyCodeProp, (code) => dataset.constituencyResults[code] || 'NONE');

        if (mode === 'party-percentage' && options?.selectedParty) {
            this.updatePartyPercentageLayers(locationData, options.selectedParty);
        } else {
            this.updateElectionLayers(locationData, dataset.partyInfo);
        }

        this.setupEventHandlers('general-election', dataset.constituencyData, constituencyCodeProp);
    }

    // ============================================================================
    // Public API - Population Methods
    // ============================================================================

    updateMapForPopulation(geojson: BoundaryGeojson, dataset: PopulationDataset): void {
        this.updatePopulationMap(geojson, dataset, 'age');
    }

    updateMapForGender(geojson: BoundaryGeojson, dataset: PopulationDataset): void {
        this.updatePopulationMap(geojson, dataset, 'gender');
    }

    updateMapForPopulationDensity(geojson: BoundaryGeojson, dataset: PopulationDataset): void {
        this.updatePopulationMap(geojson, dataset, 'density');
    }

    private updatePopulationMap(
        geojson: BoundaryGeojson,
        dataset: PopulationDataset,
        mode: PopulationMode
    ): void {
        const wardCodeProp = this.detectPropertyKey(geojson, MapManager.WARD_CODE_KEYS);
        console.log(`EXPENSIVE: updateMapForPopulation (${mode}): Filtered wards`, geojson.features.length);

        const colorFunctions = {
            age: (wardPop: any) => getColorForAge(calculateMedianAge(wardPop)),
            gender: (wardPop: any) => {
                const males = calculateTotal(wardPop.males);
                const females = calculateTotal(wardPop.females);
                return getColorForGenderRatio(females > 0 ? males / females : 0);
            },
            density: (wardPop: any, areaSqKm: number) => {
                const total = calculateTotal(wardPop.males) + calculateTotal(wardPop.females);
                return getColorForDensity(areaSqKm > 0 ? total / areaSqKm : 0);
            }
        };

        const locationData = {
            type: 'FeatureCollection' as const,
            features: geojson.features.map((feature) => {
                const wardCode = feature.properties[wardCodeProp];
                const wardPopulation = dataset.populationData[wardCode];

                if (!wardPopulation) {
                    return { ...feature, properties: { ...feature.properties, color: '#cccccc' } };
                }

                const areaSqKm = mode === 'density' ? polygonAreaSqKm(feature.geometry.coordinates) : 0;
                const color = mode === 'density'
                    ? colorFunctions[mode](wardPopulation, areaSqKm)
                    : colorFunctions[mode](wardPopulation);

                return {
                    ...feature,
                    properties: { ...feature.properties, color }
                };
            })
        };

        this.removeExistingLayers();
        this.addSource(locationData);
        this.addPopulationLayers();
        this.setupEventHandlers('population', dataset.populationData, wardCodeProp);
    }

    // ============================================================================
    // Public API - Stats Calculation
    // ============================================================================

    calculateLocalElectionStats(
        geojson: BoundaryGeojson,
        wardData: LocalElectionDataset['wardData'],
        location: string | null = null,
        datasetId: string | null = null,
    ) {
        const cacheKey = `local-election-${location}-${datasetId}`;
        if (this.cache.has(cacheKey)) {
            console.log(`CACHE HIT: calculateLocalElectionStats: [${cacheKey}]`);
            return this.cache.get(cacheKey);
        }

        const wardCodeProp = this.detectPropertyKey(geojson, MapManager.WARD_CODE_KEYS);
        console.log(`EXPENSIVE: calculateLocalElectionStats: [${cacheKey}] Processing ${geojson.features.length} wards`);

        const stats: WardStats = {
            partyVotes: {
                LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0,
                DUP: 0, PC: 0, SNP: 0, SF: 0, APNI: 0, SDLP: 0
            },
            electorate: 0,
            totalVotes: 0
        };

        geojson.features.forEach((feature) => {
            const ward = wardData[feature.properties[wardCodeProp]];
            if (!ward) return;

            (Object.keys(stats.partyVotes) as Array<keyof PartyVotes>).forEach(party => {
                stats.partyVotes[party] += (ward.partyVotes[party] as number) || 0;
            });
            stats.electorate += ward.electorate;
            stats.totalVotes += ward.totalVotes;
        });

        this.cache.set(cacheKey, stats);
        return stats;
    }

    calculateGeneralElectionStats(
        geojson: BoundaryGeojson,
        constituencyData: GeneralElectionDataset['constituencyData'],
        location: string | null = null,
        datasetId: string | null = null,
    ) {
        const cacheKey = `general-election-${location}-${datasetId}`;
        if (this.cache.has(cacheKey)) {
            console.log(`CACHE HIT: calculateGeneralElectionStats: [${cacheKey}]`);
            return this.cache.get(cacheKey);
        }

        const constituencyCodeProp = this.detectPropertyKey(geojson, MapManager.CONSTITUENCY_CODE_KEYS);
        console.log(`EXPENSIVE: calculateGeneralElectionStats: [${cacheKey}] Processing ${geojson.features.length} constituencies`);

        const stats: ConstituencyStats = {
            totalSeats: 0,
            electorate: 0,
            validVotes: 0,
            invalidVotes: 0,
            partySeats: {},
            totalVotes: 0,
            partyVotes: {},
        };

        geojson.features.forEach((feature) => {
            const constituency = constituencyData[feature.properties[constituencyCodeProp]];
            if (!constituency) return;

            stats.totalSeats += 1;
            stats.electorate += constituency.electorate;
            stats.validVotes += constituency.validVotes;
            stats.invalidVotes += constituency.invalidVotes;

            const winningParty = getWinningParty(constituency);
            if (winningParty) {
                stats.partySeats[winningParty] = (stats.partySeats[winningParty] || 0) + 1;
            }

            MapManager.PARTY_KEYS.forEach(party => {
                const votes = constituency.partyVotes[party] || 0;
                if (votes > 0) {
                    stats.totalVotes += votes;
                    stats.partyVotes[party] = (stats.partyVotes[party] || 0) + votes;
                }
            });
        });

        this.cache.set(cacheKey, stats);
        return stats;
    }

    calculatePopulationStats(
        geojson: BoundaryGeojson,
        populationData: PopulationDataset['populationData'],
        location: string | null = null,
        datasetId: string | null = null,
    ) {
        const cacheKey = `population-${location}-${datasetId}`;
        if (this.cache.has(cacheKey)) {
            console.log(`CACHE HIT: calculatePopulationStats: [${cacheKey}]`);
            return this.cache.get(cacheKey);
        }

        const wardCodeProp = this.detectPropertyKey(geojson, MapManager.WARD_CODE_KEYS);
        console.log(`EXPENSIVE: calculatePopulationStats: [${cacheKey}] Processing ${geojson.features.length} wards`);

        const aggregated = {
            totalPop: 0,
            malesPop: 0,
            femalesPop: 0,
            totalArea: 0,
            ageGroups: {
                total: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups,
                males: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups,
                females: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups
            },
            ageData: {} as Record<string, number>,
            males: {} as Record<string, number>,
            females: {} as Record<string, number>
        };

        geojson.features.forEach((feature) => {
            const ward = populationData[feature.properties[wardCodeProp]];
            if (!ward) return;

            aggregated.totalPop += calculateTotal(ward.total);
            aggregated.malesPop += calculateTotal(ward.males);
            aggregated.femalesPop += calculateTotal(ward.females);

            const wardAgeGroups = {
                total: calculateAgeGroups(ward.total),
                males: calculateAgeGroups(ward.males),
                females: calculateAgeGroups(ward.females)
            };

            (Object.keys(aggregated.ageGroups.total) as Array<keyof AgeGroups>).forEach(ageGroup => {
                aggregated.ageGroups.total[ageGroup] += wardAgeGroups.total[ageGroup];
                aggregated.ageGroups.males[ageGroup] += wardAgeGroups.males[ageGroup];
                aggregated.ageGroups.females[ageGroup] += wardAgeGroups.females[ageGroup];
            });

            Object.entries(ward.total).forEach(([age, count]) => {
                aggregated.ageData[age] = (aggregated.ageData[age] || 0) + count;
            });

            Object.entries(ward.males).forEach(([age, count]) => {
                aggregated.males[age] = (aggregated.males[age] || 0) + count;
            });

            Object.entries(ward.females).forEach(([age, count]) => {
                aggregated.females[age] = (aggregated.females[age] || 0) + count;
            });

            aggregated.totalArea += polygonAreaSqKm(feature.geometry.coordinates);
        });

        const result = this.buildPopulationStatsResult(aggregated);
        this.cache.set(cacheKey, result);
        return result;
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    private buildPopulationStatsResult(aggregated: any) {
        const populationStats: PopulationStats = {
            total: aggregated.totalPop,
            males: aggregated.malesPop,
            females: aggregated.femalesPop,
            ageGroups: aggregated.ageGroups,
            isWardSpecific: false
        };

        // Distribute 90+ age data
        const ages = Array.from({ length: 100 }, (_, i) => ({
            age: i,
            count: aggregated.ageData[i.toString()] || 0
        }));

        const age90Plus = ages[90].count;
        const decayRate = 0.15;
        const weights = Array.from({ length: 10 }, (_, i) => Math.exp(-decayRate * i));
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);

        for (let i = 90; i < 100; i++) {
            ages[i] = { age: i, count: (age90Plus * weights[i - 90]) / totalWeight };
        }

        // Build gender age data
        const genderAgeData = Array.from({ length: 91 }, (_, age) => ({
            age,
            males: aggregated.males[age.toString()] || 0,
            females: aggregated.females[age.toString()] || 0
        }));

        // Calculate median age
        let medianAge = 0;
        if (aggregated.totalPop > 0) {
            const halfPop = aggregated.totalPop / 2;
            let cumulative = 0;
            for (const { age, count } of ages) {
                cumulative += count;
                if (cumulative >= halfPop) {
                    medianAge = age;
                    break;
                }
            }
        }

        const density = aggregated.totalArea > 0 ? aggregated.totalPop / aggregated.totalArea : 0;

        return {
            populationStats,
            ageData: aggregated.ageData,
            ages,
            genderAgeData,
            medianAge,
            totalArea: aggregated.totalArea,
            density,
        };
    }

    private detectPropertyKey(geojson: BoundaryGeojson, possibleKeys: string[]): string {
        const firstFeature = geojson.features[0];
        if (!firstFeature) return possibleKeys[0];
        return possibleKeys.find(key => key in firstFeature.properties) ?? possibleKeys[0];
    }

    // ============================================================================
    // Layer Management
    // ============================================================================

    private updateElectionLayers(locationData: BoundaryGeojson, partyInfo: Party[]) {
        this.removeExistingLayers();
        this.addSource(locationData);

        const colorExpression: any[] = ['match', ['get', 'winningParty']];
        partyInfo.forEach(party => {
            colorExpression.push(party.key, PARTY_COLORS[party.key]);
        });
        colorExpression.push('#cccccc');

        this.map.addLayer({
            id: MapManager.FILL_LAYER_ID,
            type: 'fill',
            source: MapManager.SOURCE_ID,
            paint: {
                'fill-color': colorExpression,
                'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.35, 0.6]
            }
        });

        this.addBorderLayer();
    }

    private updatePartyPercentageLayers(locationData: BoundaryGeojson, partyCode: string) {
        this.removeExistingLayers();
        this.addSource(locationData);

        const baseColor = PARTY_COLORS[partyCode] || '#999999';
        const partyRgb = hexToRgb(baseColor);
        const lightRgb = { r: 245, g: 245, b: 245 };

        const fillColorExpression: any = [
            'case',
            ['==', ['get', 'percentage'], null],
            '#f5f5f5',
            [
                'interpolate',
                ['linear'],
                ['get', 'percentage'],
                0, `rgb(${lightRgb.r}, ${lightRgb.g}, ${lightRgb.b})`,
                100, `rgb(${partyRgb.r}, ${partyRgb.g}, ${partyRgb.b})`
            ]
        ];

        this.map.addLayer({
            id: MapManager.FILL_LAYER_ID,
            type: 'fill',
            source: MapManager.SOURCE_ID,
            paint: {
                'fill-color': fillColorExpression,
                'fill-opacity': 0.7,
            }
        });

        this.addBorderLayer();
    }

    private addPopulationLayers() {
        this.map.addLayer({
            id: MapManager.FILL_LAYER_ID,
            type: 'fill',
            source: MapManager.SOURCE_ID,
            paint: {
                'fill-color': ['get', 'color'],
                'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.35, 0.6]
            }
        });

        this.addBorderLayer();
    }

    private addBorderLayer() {
        this.map.addLayer({
            id: MapManager.LINE_LAYER_ID,
            type: 'line',
            source: MapManager.SOURCE_ID,
            paint: {
                'line-color': '#000',
                'line-width': 1,
                'line-opacity': 0.05
            }
        });
    }

    private removeExistingLayers() {
        if (this.map.getSource(MapManager.SOURCE_ID)) {
            [MapManager.FILL_LAYER_ID, MapManager.LINE_LAYER_ID].forEach(layerId => {
                if (this.map.getLayer(layerId)) {
                    this.map.removeLayer(layerId);
                }
            });
            this.map.removeSource(MapManager.SOURCE_ID);
        }
    }

    private addSource(locationData: BoundaryGeojson) {
        this.map.addSource(MapManager.SOURCE_ID, {
            type: 'geojson',
            data: locationData
        });
    }

    // ============================================================================
    // Feature Building
    // ============================================================================

    private buildWinnerFeatures(
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

    private buildPartyPercentageFeatures(
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
                const totalVotes = Object.values(locationData?.partyVotes || {}).reduce((sum, v) => sum + v, 0);
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

    // ============================================================================
    // Event Handlers
    // ============================================================================

    private setupEventHandlers(
        mode: MapMode,
        data: any,
        codeProp: string,
    ) {
        this.map.off('mousemove', MapManager.FILL_LAYER_ID);
        this.map.off('mouseleave', MapManager.FILL_LAYER_ID);

        this.map.on('mousemove', MapManager.FILL_LAYER_ID, (e) => {
            if (!e.features?.length) return;

            this.map.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0];
            this.updateHoverState(feature);

            const code = feature.properties[codeProp];
            const locationData = data[code];

            if (mode === 'general-election') {
                this.callbacks.onConstituencyHover?.(locationData || null);
            } else if (mode === 'population') {
                this.handlePopulationHover(code, locationData);
            } else {
                this.callbacks.onWardHover?.({ data: locationData || null, wardCode: code });
            }
        });

        this.map.on('mouseleave', MapManager.FILL_LAYER_ID, () => {
            this.clearHoverState();
            this.map.getCanvas().style.cursor = '';

            if (mode === 'general-election') {
                this.callbacks.onConstituencyHover?.(null);
            } else {
                this.callbacks.onWardHover?.({ data: null, wardCode: '' });
            }
        });
    }

    private handlePopulationHover(wardCode: string, wardPopData: any) {
        if (!this.callbacks.onWardHover) return;

        if (wardPopData) {
            const wardData: any = {
                wardCode,
                wardName: wardPopData.wardName || '',
                localAuthorityCode: wardPopData.laCode || '',
                localAuthorityName: wardPopData.laName || '',
                LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0
            };
            this.callbacks.onWardHover({ data: wardData, wardCode });
        } else {
            this.callbacks.onWardHover({ data: null, wardCode });
        }
    }

    private updateHoverState(feature: GeoJSONFeature) {
        if (this.lastHoveredFeatureId !== null && this.lastHoveredFeatureId !== feature.id) {
            this.map.setFeatureState(
                { source: MapManager.SOURCE_ID, id: this.lastHoveredFeatureId },
                { hover: false }
            );
        }

        this.map.setFeatureState(
            { source: MapManager.SOURCE_ID, id: feature.id },
            { hover: true }
        );
        this.lastHoveredFeatureId = feature.id;
    }

    private clearHoverState() {
        if (this.lastHoveredFeatureId !== null) {
            this.map.setFeatureState(
                { source: MapManager.SOURCE_ID, id: this.lastHoveredFeatureId },
                { hover: false }
            );
            this.lastHoveredFeatureId = null;
        }
    }
}