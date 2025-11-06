// lib/utils/mapManager.ts
import { ChartData, LocalElectionWardData, Party, PopulationWardData, BoundaryGeojson, ConstituencyData, LocalElectionDataset, GeneralElectionDataset, PopulationDataset } from '@lib/types';
import { PARTY_COLORS } from '../data/parties';
import { GeoJSONFeature } from 'mapbox-gl';

interface MapManagerCallbacks {
    onWardHover?: (params: { data: LocalElectionWardData | null; wardCode: string }) => void;
    onConstituencyHover?: (data: ConstituencyData | null) => void;
    onLocationChange: (location: string) => void;
}

interface LocationCodeInfo {
    property: string | null;
    fallbackToWardMapping: boolean;
}

interface ConstituencyStats {
    totalSeats: number;
    partySeats: Record<string, number>;
    totalVotes: number;
    partyVotes: Record<string, number>;
}

type MapMode = 'local-election' | 'general-election' | 'population';

export class MapManager {
    private map: mapboxgl.Map;
    private callbacks: MapManagerCallbacks;
    private lastHoveredFeatureId: any = null;
    private cache = new Map<string, any>();
    private wardToLadMapping = new Map<string, string>();

    // Layer and source constants
    private static readonly SOURCE_ID = 'location-wards';
    private static readonly FILL_LAYER_ID = 'wards-fill';
    private static readonly LINE_LAYER_ID = 'wards-line';

    // Property detection keys
    private static readonly WARD_CODE_KEYS = ['WD24CD', 'WD23CD', 'WD22CD', 'WD21CD'];
    private static readonly LAD_CODE_KEYS = ['LAD24CD', 'LAD23CD', 'LAD22CD', 'LAD21CD'];
    private static readonly CONSTITUENCY_CODE_KEYS = ['PCON24CD', 'PCON25CD'];
    private static readonly PARTY_KEYS = ['LAB', 'CON', 'LD', 'GREEN', 'RUK', 'SNP', 'PC', 'DUP', 'SF', 'OTHER'];

    constructor(map: mapboxgl.Map, callbacks: MapManagerCallbacks) {
        this.map = map;
        this.callbacks = callbacks;
    }

    // ============================================================================
    // Public API Methods
    // ============================================================================

    /**
     * Update map for local election results
     * Calculates and returns location stats
     */
    updateMapForLocalElection(
        geojson: BoundaryGeojson,
        wardResults: LocalElectionDataset['wardResults'],
        wardData: LocalElectionDataset['wardData'],
        partyInfo: Party[],
        // location: string | null, 
    ) {
        const wardCodeProp = this.detectPropertyKey(geojson, MapManager.WARD_CODE_KEYS);

        console.log('EXPENSIVE: updateMapForLocalElection: Filtered wards', geojson.features.length);

        // Build and render map
        const locationData = this.buildFeatureCollection(
            geojson.features,
            (feature) => wardResults[feature.properties[wardCodeProp]] || 'NONE'
        );

        this.updateMapLayers(locationData, partyInfo);
        this.setupEventHandlers('local-election', wardData, wardCodeProp);
        this.buildWardToLadMapping(geojson);

        // if (location) {
        //     this.callbacks.onLocationChange(location);
        // }
    }

    /**
     * Update map for general election results
     * Calculates and returns location stats
     */
    updateMapForGeneralElection(
        geojson: BoundaryGeojson,
        constituencyResults: GeneralElectionDataset['constituencyResults'],
        constituencyData: GeneralElectionDataset['constituencyData'],
        partyInfo: Party[],
        // location: string | null,
    ) {
        const constituencyCodeProp = this.detectPropertyKey(geojson, MapManager.CONSTITUENCY_CODE_KEYS);

        console.log('EXPENSIVE: updateMapForGeneralElection: Filtered constituencies:', geojson.features.length);

        // Build and render map
        const locationData = this.buildFeatureCollection(
            geojson.features,
            (feature) => constituencyResults[feature.properties[constituencyCodeProp]] || 'NONE'
        );

        this.updateMapLayers(locationData, partyInfo);
        this.setupEventHandlers('general-election', constituencyData, constituencyCodeProp);

        // if (location) {
        //     this.callbacks.onLocationChange(location);
        // }
    }

    /**
     * Update map for population age heatmap
     */
    updateMapForPopulation(
        geojson: BoundaryGeojson,
        populationData: PopulationDataset['populationData'] ,
    ): void {
        const wardCodeProp = this.detectPropertyKey(geojson, MapManager.WARD_CODE_KEYS);

        console.log('EXPENSIVE: updateMapForPopulation: Filtered wards', geojson.features.length);

        const locationData = {
            type: 'FeatureCollection' as const,
            features: geojson.features.map((feature) => {
                const wardCode = feature.properties[wardCodeProp];
                const wardPopulation = populationData[wardCode];
                const medianAge = this.calculateMedianAge(wardPopulation);

                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        medianAge: medianAge,
                        color: this.getColorForAge(medianAge)
                    }
                };
            })
        };

        this.removeExistingLayers();
        this.addSource(locationData);
        this.addPopulationLayers();
        this.setupEventHandlers('population', populationData, wardCodeProp);
        this.buildWardToLadMapping(geojson);

        // if (location) {
        //     this.callbacks.onLocationChange(location);
        // }
    }

    /**
     * Build mapping of ward codes to LAD codes
     */
    buildWardToLadMapping(geojson: BoundaryGeojson) {
        const wardCodeProp = this.detectPropertyKey(geojson, MapManager.WARD_CODE_KEYS);
        const locationCodeInfo = this.detectLocationCodeInfo(geojson);

        if (locationCodeInfo.fallbackToWardMapping || !locationCodeInfo.property) {
            return;
        }

        geojson.features.forEach((feature: any) => {
            const wardCode = feature.properties[wardCodeProp];
            const ladCode = feature.properties[locationCodeInfo.property!];

            if (wardCode && ladCode) {
                this.wardToLadMapping.set(wardCode, ladCode);
            }
        });
    }

    // ============================================================================
    // Stats Calculation Methods (for external use, e.g., aggregated data)
    // ============================================================================

    /**
     * Calculate aggregated stats for local elections (public method for hooks)
     */
    calculateLocalElectionStats(
        geojson: BoundaryGeojson,
        wardData: LocalElectionDataset['wardData'],
        datasetId: string | null = null
    ): ChartData {
        const wardCodeProp = this.detectPropertyKey(geojson, MapManager.WARD_CODE_KEYS);

        return this.calculateLocalElectionStatsInternal(
            geojson.features,
            wardCodeProp,
            wardData,
            datasetId
        );
    }

    /**
     * Calculate aggregated stats for general elections (public method for hooks)
     */
    calculateGeneralElectionStats(
        geojson: BoundaryGeojson,
        constituencyData: GeneralElectionDataset['constituencyData'],
        datasetId: string | null = null
    ): ConstituencyStats {
        const constituencyCodeProp = this.detectPropertyKey(geojson, MapManager.CONSTITUENCY_CODE_KEYS);

        return this.calculateGeneralElectionStatsInternal(
            geojson.features,
            constituencyCodeProp,
            constituencyData,
            datasetId
        );
    }

    // ============================================================================
    // Internal Stats Calculation Methods
    // ============================================================================

    /**
     * Internal method to calculate local election stats from filtered wards
     */
    private calculateLocalElectionStatsInternal(
        geojson: BoundaryGeojson['features'],
        wardCodeProp: string,
        wardData: LocalElectionDataset['wardData'],
        location: string | null = null,
        datasetId: string | null = null
    ): ChartData {
        const cacheKey = `local-election-${location}-${datasetId}`;

        if (this.cache.has(cacheKey)) {
            console.log(`CACHE HIT: calculateLocalElectionStats: [${cacheKey}]`);
            return this.cache.get(cacheKey);
        }

        console.log(`EXPENSIVE: calculateLocalElectionStats: [${cacheKey}] Processing ${geojson.length} wards`);

        const aggregated: ChartData = {
            LAB: 0,
            CON: 0,
            LD: 0,
            GREEN: 0,
            REF: 0,
            IND: 0,
            DUP: 0,
            PC: 0,
            SNP: 0,
            SF: 0,
            APNI: 0,
            SDLP: 0,
        };

        geojson.forEach((feature: any) => {
            const wardCode = feature.properties[wardCodeProp];
            const ward = wardData[wardCode];

            if (ward) {
                aggregated.LAB += (ward.LAB as number) || 0;
                aggregated.CON += (ward.CON as number) || 0;
                aggregated.LD += (ward.LD as number) || 0;
                aggregated.GREEN += (ward.GREEN as number) || 0;
                aggregated.REF += (ward.REF as number) || 0;
                aggregated.IND += (ward.IND as number) || 0;
                aggregated.DUP += (ward.DUP as number) || 0;
                aggregated.PC += (ward.PC as number) || 0;
                aggregated.SNP += (ward.SNP as number) || 0;
                aggregated.SF += (ward.SF as number) || 0;
                aggregated.APNI += (ward.APNI as number) || 0;
                aggregated.SDLP += (ward.SDLP as number) || 0;
            }
        });

        this.cache.set(cacheKey, aggregated);
        return aggregated;
    }

    /**
     * Internal method to calculate general election stats from filtered constituencies
     */
    private calculateGeneralElectionStatsInternal(
        geojson: BoundaryGeojson['features'],
        constituencyCodeProp: string,
        constituencyData: GeneralElectionDataset['constituencyData'],
        location: string | null = null,
        datasetId: string | null = null
    ): ConstituencyStats {
        const cacheKey = `general-election-${location}-${datasetId}`;

        if (this.cache.has(cacheKey)) {
            console.log(`CACHE HIT: calculateGeneralElectionStats: [${cacheKey}]`);
            return this.cache.get(cacheKey);
        }

        console.log(`EXPENSIVE: calculateGeneralElectionStats: [${cacheKey}] Processing ${geojson.length} constituencies`);

        const aggregated: ConstituencyStats = {
            totalSeats: 0,
            partySeats: {},
            totalVotes: 0,
            partyVotes: {},
        };

        geojson.forEach((feature: BoundaryGeojson['features'][0]) => {
            const onsId = feature.properties[constituencyCodeProp];
            const data = constituencyData[onsId];

            if (!data) return;

            aggregated.totalSeats += 1;

            // Find winning party
            const winningParty = this.getWinningParty(data);
            if (winningParty) {
                aggregated.partySeats[winningParty] = (aggregated.partySeats[winningParty] || 0) + 1;
            }

            // Aggregate votes
            MapManager.PARTY_KEYS.forEach(party => {
                const votes = data[party] || 0;
                if (votes > 0) {
                    aggregated.totalVotes += votes;
                    aggregated.partyVotes[party] = (aggregated.partyVotes[party] || 0) + votes;
                }
            });
        });

        this.cache.set(cacheKey, aggregated);
        return aggregated;
    }

    /**
     * Convert constituency stats to ChartData format
     */
    // private constituencyStatsToChartData(stats: ConstituencyStats): ChartData {
    //     return {
    //         LAB: stats.partyVotes.LAB || 0,
    //         CON: stats.partyVotes.CON || 0,
    //         LD: stats.partyVotes.LD || 0,
    //         GREEN: stats.partyVotes.GREEN || 0,
    //         REF: stats.partyVotes.RUK || 0, // Map RUK to REF
    //         IND: stats.partyVotes.OTHER || 0, // Map OTHER to IND
    //         DUP: stats.partyVotes.DUP || 0,
    //         SF: stats.partyVotes.SF || 0,
    //         SDLP: stats.partyVotes.SDLP || 0,
    //         APNI: stats.partyVotes.APNI || 0,
    //         SNP: stats.partyVotes.SNP || 0,
    //         PC: stats.partyVotes.PC || 0,
    //     };
    // }

    // ============================================================================
    // Property Detection Methods
    // ============================================================================

    /**
     * Detect property key from a list of possible keys
     */
    private detectPropertyKey(geojson: BoundaryGeojson, possibleKeys: string[]) {
        const firstFeature = geojson.features[0];
        if (!firstFeature) return possibleKeys[0];

        const props = firstFeature.properties as Record<string, unknown>;
        const match = possibleKeys.find(key => key in props);
        return match ?? possibleKeys[0];
    }

    /**
     * Detect location code property (LAD codes)
     */
    private detectLocationCodeInfo(geojson: BoundaryGeojson): LocationCodeInfo {
        const firstFeature = geojson.features[0];
        if (!firstFeature) {
            return { property: MapManager.LAD_CODE_KEYS[0], fallbackToWardMapping: false };
        }

        const props = firstFeature.properties as Record<string, unknown>;
        const ladMatch = MapManager.LAD_CODE_KEYS.find(key => key in props);

        if (ladMatch) {
            return { property: ladMatch, fallbackToWardMapping: false };
        }

        return { property: null, fallbackToWardMapping: true };
    }

    // ============================================================================
    // Map Layer Management
    // ============================================================================

    /**
     * Update map layers with new data
     */
    private updateMapLayers(locationData: BoundaryGeojson, partyInfo: Party[]) {
        this.removeExistingLayers();
        this.addSource(locationData);
        this.addElectionLayers(partyInfo);
    }

    /**
     * Remove existing map layers
     */
    private removeExistingLayers() {
        if (this.map.getSource(MapManager.SOURCE_ID)) {
            if (this.map.getLayer(MapManager.FILL_LAYER_ID)) {
                this.map.removeLayer(MapManager.FILL_LAYER_ID);
            }
            if (this.map.getLayer(MapManager.LINE_LAYER_ID)) {
                this.map.removeLayer(MapManager.LINE_LAYER_ID);
            }
            this.map.removeSource(MapManager.SOURCE_ID);
        }
    }

    /**
     * Add GeoJSON source to map
     */
    private addSource(locationData: BoundaryGeojson) {
        this.map.addSource(MapManager.SOURCE_ID, {
            type: 'geojson',
            data: locationData
        });
    }

    /**
     * Add election result layers
     */
    private addElectionLayers(partyInfo: Party[]) {
        const colorExpression: any[] = ['match', ['get', 'winningParty']];

        partyInfo.forEach(party => {
            colorExpression.push(party.key, PARTY_COLORS[party.key]);
        });

        colorExpression.push('#cccccc'); // Default color

        this.map.addLayer({
            id: MapManager.FILL_LAYER_ID,
            type: 'fill',
            source: MapManager.SOURCE_ID,
            paint: {
                'fill-color': colorExpression,
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    0.35,
                    0.6
                ]
            }
        });

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

    /**
     * Add population heatmap layers
     */
    private addPopulationLayers() {
        this.map.addLayer({
            id: MapManager.FILL_LAYER_ID,
            type: 'fill',
            source: MapManager.SOURCE_ID,
            paint: {
                'fill-color': ['get', 'color'],
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    0.35,
                    0.6
                ]
            }
        });

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

    // ============================================================================
    // Event Handler Setup
    // ============================================================================

    /**
     * Setup event handlers based on map mode
     */
    private setupEventHandlers(
        mode: MapMode,
        data: LocalElectionDataset['wardData'] | GeneralElectionDataset['constituencyData'] | PopulationDataset['populationData'],
        codeProp: string
    ) {
        // Remove existing handlers
        this.map.off('mousemove', MapManager.FILL_LAYER_ID);
        this.map.off('mouseleave', MapManager.FILL_LAYER_ID);

        // Add new handlers
        this.map.on('mousemove', MapManager.FILL_LAYER_ID, (e) => {
            this.handleMouseMove(e, mode, data, codeProp);
        });

        this.map.on('mouseleave', MapManager.FILL_LAYER_ID, () => {
            this.handleMouseLeave(mode);
        });
    }

    /**
     * Handle mouse move event
     */
    private handleMouseMove(
        e: mapboxgl.MapMouseEvent,
        mode: MapMode,
        data: LocalElectionDataset['wardData'] | GeneralElectionDataset['constituencyData'] | PopulationDataset['populationData'],
        codeProp: string
    ) {
        this.map.getCanvas().style.cursor = 'pointer';

        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            this.updateHoverState(feature);

            switch (mode) {
                case 'local-election':
                    this.handleLocalElectionHover(feature, data as LocalElectionDataset['wardData'], codeProp);
                    break;
                case 'general-election':
                    this.handleGeneralElectionHover(feature, data as GeneralElectionDataset['constituencyData'], codeProp);
                    break;
                case 'population':
                    this.handlePopulationHover(feature, data as PopulationDataset['populationData'], codeProp);
                    break;
            }
        }
    }

    /**
     * Handle mouse leave event
     */
    private handleMouseLeave(mode: MapMode) {
        this.clearHoverState();
        this.map.getCanvas().style.cursor = '';

        if (mode === 'general-election' && this.callbacks.onConstituencyHover) {
            this.callbacks.onConstituencyHover(null);
        } else if (this.callbacks.onWardHover) {
            this.callbacks.onWardHover({ data: null, wardCode: '' });
        }
    }

    /**
     * Update hover state for a feature
     */
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

    /**
     * Clear hover state
     */
    private clearHoverState() {
        if (this.lastHoveredFeatureId !== null) {
            this.map.setFeatureState(
                { source: MapManager.SOURCE_ID, id: this.lastHoveredFeatureId },
                { hover: false }
            );
        }
    }

    /**
     * Handle hover for local elections
     */
    private handleLocalElectionHover(
        feature: GeoJSONFeature,
        wardData: LocalElectionDataset['wardData'],
        wardCodeProp: string
    ) {
        const wardCode = feature.properties[wardCodeProp];
        const data = wardData[wardCode];

        if (this.callbacks.onWardHover) {
            this.callbacks.onWardHover({
                data: data || null,
                wardCode: wardCode
            });
        }
    }

    /**
     * Handle hover for general elections
     */
    private handleGeneralElectionHover(
        feature: GeoJSONFeature,
        constituencyData: GeneralElectionDataset['constituencyData'],
        constituencyCodeProp: string
    ) {
        const onsId = feature.properties[constituencyCodeProp];
        const data = constituencyData[onsId];

        if (this.callbacks.onConstituencyHover) {
            this.callbacks.onConstituencyHover(data || null);
        }
    }

    /**
     * Handle hover for population mode
     */
    private handlePopulationHover(
        feature: GeoJSONFeature,
        populationData: PopulationDataset['populationData'],
        wardCodeProp: string
    ) {
        const wardCode = feature.properties[wardCodeProp];
        const wardPopData = populationData[wardCode];

        if (wardPopData && this.callbacks.onWardHover) {
            const wardData: PopulationDataset['populationData'] = {
                wardCode: wardCode,
                wardName: wardPopData.wardName || '',
                localAuthorityCode: wardPopData.laCode || '',
                localAuthorityName: wardPopData.laName || '',
                LAB: 0,
                CON: 0,
                LD: 0,
                GREEN: 0,
                REF: 0,
                IND: 0
            };
            this.callbacks.onWardHover({ data: wardData, wardCode: wardCode });
        } else if (this.callbacks.onWardHover) {
            this.callbacks.onWardHover({ data: null, wardCode: wardCode });
        }
    }

    // ============================================================================
    // Data Processing Methods
    // ============================================================================

    /**
     * Build feature collection with winning party
     */
    private buildFeatureCollection(
        features: BoundaryGeojson['features'],
        getWinningParty: (feature: GeoJSONFeature) => string
    ): BoundaryGeojson {
        return {
            type: 'FeatureCollection' as const,
            features: features.map((feature) => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    winningParty: getWinningParty(feature)
                }
            }))
        };
    }

    /**
     * Get winning party from constituency data
     */
    private getWinningParty(data: Record<string, any>): string {
        let winningParty = '';
        let maxVotes = 0;

        MapManager.PARTY_KEYS.forEach(party => {
            const votes = data[party] || 0;
            if (votes > maxVotes) {
                maxVotes = votes;
                winningParty = party;
            }
        });

        return winningParty;
    }

    /**
     * Calculate median age for a ward
     */
    private calculateMedianAge(wardPopulation: PopulationDataset['populationData']): number | null {
        if (!wardPopulation?.total) return null;

        const ageData = wardPopulation.total;
        let totalPop = 0;
        let cumulativeSum = 0;

        // Calculate total population
        for (let age = 0; age <= 90; age++) {
            totalPop += ageData[age] || 0;
        }

        const halfPop = totalPop / 2;

        // Find median age
        for (let age = 0; age <= 90; age++) {
            cumulativeSum += ageData[age] || 0;
            if (cumulativeSum >= halfPop) {
                return age;
            }
        }

        return null;
    }

    /**
     * Get color for age (Viridis color scale)
     */
    private getColorForAge(meanAge: number | null): string {
        if (meanAge === null) return 'rgb(253, 253, 253)';

        const t = 1 - Math.max(0, Math.min(1, (meanAge - 25) / 30));

        const colors = [
            { pos: 0.00, color: [68, 1, 84] },      // purple
            { pos: 0.25, color: [59, 82, 139] },    // blue
            { pos: 0.50, color: [33, 145, 140] },   // teal
            { pos: 0.75, color: [94, 201, 98] },    // green
            { pos: 1.00, color: [253, 231, 37] }    // yellow
        ];

        for (let i = 0; i < colors.length - 1; i++) {
            if (t >= colors[i].pos && t <= colors[i + 1].pos) {
                const localT = (t - colors[i].pos) / (colors[i + 1].pos - colors[i].pos);
                const c1 = colors[i].color;
                const c2 = colors[i + 1].color;
                const r = Math.round(c1[0] + (c2[0] - c1[0]) * localT);
                const g = Math.round(c1[1] + (c2[1] - c1[1]) * localT);
                const b = Math.round(c1[2] + (c2[2] - c1[2]) * localT);
                return `rgb(${r}, ${g}, ${b})`;
            }
        }
        return 'rgb(253, 253, 253)';
    }
}