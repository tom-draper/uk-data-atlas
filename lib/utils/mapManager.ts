// lib/utils/mapManager.ts
import { PartyVotes, LocalElectionWardData, Party, BoundaryGeojson, ConstituencyData, LocalElectionDataset, GeneralElectionDataset, PopulationDataset, PopulationWardData } from '@lib/types';
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

    updateMapForLocalElection(
        geojson: BoundaryGeojson,
        dataset: LocalElectionDataset
    ) {
        const wardCodeProp = this.detectPropertyKey(geojson, MapManager.WARD_CODE_KEYS);
        console.log('EXPENSIVE: updateMapForLocalElection: Filtered wards', geojson.features.length);

        const locationData = this.buildFeatureCollection(
            geojson.features,
            (feature) => dataset.wardResults[feature.properties[wardCodeProp]] || 'NONE'
        );

        this.updateMapLayers(locationData, dataset.partyInfo);
        this.setupEventHandlers('local-election', dataset.wardData, wardCodeProp);
        this.buildWardToLadMapping(geojson);
    }

    updateMapForGeneralElection(
        geojson: BoundaryGeojson,
        dataset: GeneralElectionDataset,
    ) {
        const constituencyCodeProp = this.detectPropertyKey(geojson, MapManager.CONSTITUENCY_CODE_KEYS);
        console.log('EXPENSIVE: updateMapForGeneralElection: Filtered constituencies:', geojson.features.length);

        const locationData = this.buildFeatureCollection(
            geojson.features,
            (feature) => dataset.constituencyResults[feature.properties[constituencyCodeProp]] || 'NONE'
        );

        this.updateMapLayers(locationData, dataset.partyInfo);
        this.setupEventHandlers('general-election', dataset.constituencyData, constituencyCodeProp);
    }

    updateMapForPopulation(
        geojson: BoundaryGeojson,
        dataset: PopulationDataset,
    ): void {
        const wardCodeProp = this.detectPropertyKey(geojson, MapManager.WARD_CODE_KEYS);
        console.log('EXPENSIVE: updateMapForPopulation: Filtered wards', geojson.features.length);

        const locationData = {
            type: 'FeatureCollection' as const,
            features: geojson.features.map((feature) => {
                const wardCode = feature.properties[wardCodeProp];
                const wardPopulation = dataset.populationData[wardCode];
                const medianAge = this.calculateMedianAge(wardPopulation);

                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        color: this.getColorForAge(medianAge),
                        medianAge,
                    }
                };
            })
        };

        this.removeExistingLayers();
        this.addSource(locationData);
        this.addPopulationLayers();
        this.setupEventHandlers('population', dataset.populationData, wardCodeProp);
        this.buildWardToLadMapping(geojson);
    }

    updateMapForGender(
        geojson: BoundaryGeojson,
        dataset: PopulationDataset,
    ): void {
        const wardCodeProp = this.detectPropertyKey(geojson, MapManager.WARD_CODE_KEYS);
        console.log('EXPENSIVE: updateMapForGender: Filtered wards', geojson.features.length);

        const locationData = {
            type: 'FeatureCollection' as const,
            features: geojson.features.map((feature) => {
                const wardCode = feature.properties[wardCodeProp];
                const wardPopulation = dataset.populationData[wardCode];

                let ratio = 0;
                if (wardPopulation) {
                    const malesTotal = wardPopulation.males ? Object.values(wardPopulation.males).reduce((total, num) => total + num, 0) : 0
                    const femalesTotal = wardPopulation.females ? Object.values(wardPopulation.females).reduce((total, num) => total + num, 0) : 0
                    ratio = malesTotal / femalesTotal;
                }

                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        color: this.getColorForGenderRatio(ratio),
                        ratio,
                    }
                };
            })
        };

        this.removeExistingLayers();
        this.addSource(locationData);
        this.addPopulationLayers();
        this.setupEventHandlers('population', dataset.populationData, wardCodeProp);
        this.buildWardToLadMapping(geojson);
    }

    updateMapForPopulationDensity(
        geojson: BoundaryGeojson,
        dataset: PopulationDataset,
    ): void {
        const wardCodeProp = this.detectPropertyKey(geojson, MapManager.WARD_CODE_KEYS);
        console.log('EXPENSIVE: updateMapForGender: Filtered wards', geojson.features.length);

        const locationData = {
            type: 'FeatureCollection' as const,
            features: geojson.features.map((feature) => {
                const wardCode = feature.properties[wardCodeProp];
                const wardPopulation = dataset.populationData[wardCode];

                let totalPopulation = 0;
                if (wardPopulation) {
                    const malesTotal = wardPopulation.males ? Object.values(wardPopulation.males).reduce((total, num) => total + num, 0) : 0
                    const femalesTotal = wardPopulation.females ? Object.values(wardPopulation.females).reduce((total, num) => total + num, 0) : 0
                    totalPopulation = malesTotal + femalesTotal;
                }

                // Compute approximate area
                const coordinates = feature.geometry.coordinates;
                const areaSqKm = this.polygonAreaSqKm(coordinates);

                // Compute density
                const density = areaSqKm > 0 ? totalPopulation / areaSqKm : 0;

                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        color: this.getColorForDensity(density),
                        density
                    }
                };
            })
        };

        this.removeExistingLayers();
        this.addSource(locationData);
        this.addPopulationLayers();
        this.setupEventHandlers('population', dataset.populationData, wardCodeProp);
        this.buildWardToLadMapping(geojson);
    }

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
    // Stats Calculation Methods (for external use)
    // ============================================================================

    calculateLocalElectionStats(
        geojson: BoundaryGeojson,
        wardData: LocalElectionDataset['wardData'],
        location: string | null = null,
        datasetId: string | null = null,
    ): PartyVotes {
        const wardCodeProp = this.detectPropertyKey(geojson, MapManager.WARD_CODE_KEYS);

        return this.calculateLocalElectionStatsInternal(
            geojson.features,
            wardCodeProp,
            wardData,
            location,
            datasetId,
        );
    }

    calculateGeneralElectionStats(
        geojson: BoundaryGeojson,
        constituencyData: GeneralElectionDataset['constituencyData'],
        location: string | null = null,
        datasetId: string | null = null,
    ): ConstituencyStats {
        const constituencyCodeProp = this.detectPropertyKey(geojson, MapManager.CONSTITUENCY_CODE_KEYS);

        return this.calculateGeneralElectionStatsInternal(
            geojson.features,
            constituencyCodeProp,
            constituencyData,
            location,
            datasetId,
        );
    }

    // ============================================================================
    // Internal Stats Calculation
    // ============================================================================

    private calculateLocalElectionStatsInternal(
        geojson: BoundaryGeojson['features'],
        wardCodeProp: string,
        wardData: LocalElectionDataset['wardData'],
        location: string | null = null,
        datasetId: string | null = null,
    ): PartyVotes {
        const cacheKey = `local-election-${location}-${datasetId}`;

        if (this.cache.has(cacheKey)) {
            console.log(`CACHE HIT: calculateLocalElectionStats: [${cacheKey}]`);
            return this.cache.get(cacheKey);
        }

        console.log(`EXPENSIVE: calculateLocalElectionStats: [${cacheKey}] Processing ${geojson.length} wards`);

        const aggregated: PartyVotes = {
            LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0,
            DUP: 0, PC: 0, SNP: 0, SF: 0, APNI: 0, SDLP: 0,
        };

        geojson.forEach((feature) => {
            const wardCode = feature.properties[wardCodeProp];
            const ward = wardData[wardCode];

            if (ward) {
                // Aggregate party data
                (Object.keys(aggregated) as Array<keyof PartyVotes>).forEach(party => {
                    aggregated[party] += (ward.partyVotes[party] as number) || 0;
                });
            }
        });

        this.cache.set(cacheKey, aggregated);
        return aggregated;
    }

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

        geojson.forEach((feature) => {
            const onsId = feature.properties[constituencyCodeProp];
            const constituency = constituencyData[onsId];

            if (!constituency) return;

            aggregated.totalSeats += 1;

            const winningParty = this.getWinningParty(constituency);
            if (winningParty) {
                aggregated.partySeats[winningParty] = (aggregated.partySeats[winningParty] || 0) + 1;
            }

            MapManager.PARTY_KEYS.forEach(party => {
                const votes = constituency.partyVotes[party] || 0;
                if (votes > 0) {
                    aggregated.totalVotes += votes;
                    aggregated.partyVotes[party] = (aggregated.partyVotes[party] || 0) + votes;
                }
            });
        });

        this.cache.set(cacheKey, aggregated);
        return aggregated;
    }

    // ============================================================================
    // Property Detection
    // ============================================================================

    private detectPropertyKey(geojson: BoundaryGeojson, possibleKeys: string[]) {
        const firstFeature = geojson.features[0];
        if (!firstFeature) return possibleKeys[0];

        const props = firstFeature.properties;
        return possibleKeys.find(key => key in props) ?? possibleKeys[0];
    }

    private detectLocationCodeInfo(geojson: BoundaryGeojson): LocationCodeInfo {
        const firstFeature = geojson.features[0];
        if (!firstFeature) {
            return { property: MapManager.LAD_CODE_KEYS[0], fallbackToWardMapping: false };
        }

        const props = firstFeature.properties;
        const ladMatch = MapManager.LAD_CODE_KEYS.find(key => key in props);

        return ladMatch
            ? { property: ladMatch, fallbackToWardMapping: false }
            : { property: null, fallbackToWardMapping: true };
    }

    // ============================================================================
    // Map Layer Management
    // ============================================================================

    private updateMapLayers(locationData: BoundaryGeojson, partyInfo: Party[]) {
        this.removeExistingLayers();
        this.addSource(locationData);
        this.addElectionLayers(partyInfo);
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

    private addElectionLayers(partyInfo: Party[]) {
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
    // Event Handlers
    // ============================================================================

    private setupEventHandlers(
        mode: MapMode,
        data: LocalElectionDataset['wardData'] | GeneralElectionDataset['constituencyData'] | PopulationDataset['populationData'],
        codeProp: string,
    ) {
        this.map.off('mousemove', MapManager.FILL_LAYER_ID);
        this.map.off('mouseleave', MapManager.FILL_LAYER_ID);

        this.map.on('mousemove', MapManager.FILL_LAYER_ID, (e) => {
            this.handleMouseMove(e, mode, data, codeProp);
        });

        this.map.on('mouseleave', MapManager.FILL_LAYER_ID, () => {
            this.handleMouseLeave(mode);
        });
    }

    private handleMouseMove(
        e: mapboxgl.MapMouseEvent,
        mode: MapMode,
        data: any,
        codeProp: string,
    ) {
        this.map.getCanvas().style.cursor = 'pointer';

        if (e.features?.length) {
            const feature = e.features[0];
            this.updateHoverState(feature);

            const handlers = {
                'local-election': () => this.handleLocalElectionHover(feature, data, codeProp),
                'general-election': () => this.handleGeneralElectionHover(feature, data, codeProp),
                'population': () => this.handlePopulationHover(feature, data, codeProp),
            };

            handlers[mode]?.();
        }
    }

    private handleMouseLeave(mode: MapMode) {
        this.clearHoverState();
        this.map.getCanvas().style.cursor = '';

        if (mode === 'general-election' && this.callbacks.onConstituencyHover) {
            this.callbacks.onConstituencyHover(null);
        } else if (this.callbacks.onWardHover) {
            this.callbacks.onWardHover({ data: null, wardCode: '' });
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
        }
    }

    private handleLocalElectionHover(
        feature: GeoJSONFeature,
        wardData: LocalElectionDataset['wardData'],
        wardCodeProp: string,
    ) {
        const wardCode = feature.properties[wardCodeProp];
        const data = wardData[wardCode];

        if (this.callbacks.onWardHover) {
            this.callbacks.onWardHover({ data: data || null, wardCode });
        }
    }

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

    private handlePopulationHover(
        feature: GeoJSONFeature,
        populationData: PopulationDataset['populationData'],
        wardCodeProp: string
    ) {
        const wardCode = feature.properties[wardCodeProp];
        const wardPopData = populationData[wardCode];

        if (wardPopData && this.callbacks.onWardHover) {
            const wardData: any = {
                wardCode,
                wardName: wardPopData.wardName || '',
                localAuthorityCode: wardPopData.laCode || '',
                localAuthorityName: wardPopData.laName || '',
                LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0
            };
            this.callbacks.onWardHover({ data: wardData, wardCode });
        } else if (this.callbacks.onWardHover) {
            this.callbacks.onWardHover({ data: null, wardCode });
        }
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    private buildFeatureCollection(
        features: BoundaryGeojson['features'],
        getWinningParty: (feature: GeoJSONFeature) => string
    ): BoundaryGeojson {
        return {
            type: 'FeatureCollection',
            features: features.map(feature => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    winningParty: getWinningParty(feature)
                }
            }))
        };
    }

    private getWinningParty(data: ConstituencyData): string {
        let winningParty = '';
        let maxVotes = 0;

        MapManager.PARTY_KEYS.forEach(party => {
            const votes = data.partyVotes[party] || 0;
            if (votes > maxVotes) {
                maxVotes = votes;
                winningParty = party;
            }
        });

        return winningParty;
    }

    private calculateMedianAge(wardPopulation: PopulationWardData): number | null {
        if (!wardPopulation?.total) return null;

        const ageData = wardPopulation.total;
        let totalPop = 0;

        for (let age = 0; age <= 90; age++) {
            totalPop += ageData[age] || 0;
        }

        const halfPop = totalPop / 2;
        let cumulativeSum = 0;

        for (let age = 0; age <= 90; age++) {
            cumulativeSum += ageData[age] || 0;
            if (cumulativeSum >= halfPop) return age;
        }

        return null;
    }

    // Calculates polygon area in square kilometers (roughly accurate for small areas)
    private polygonAreaSqKm(coordinates: number[][][]): number {
        const R = 6371; // Earth's radius in km

        // Assuming coordinates[0] is the outer ring
        const ring = coordinates[0];
        let area = 0;

        for (let i = 0; i < ring.length - 1; i++) {
            const [lon1, lat1] = ring[i];
            const [lon2, lat2] = ring[i + 1];

            // Convert degrees to radians
            const x1 = (lon1 * Math.PI) / 180;
            const y1 = (lat1 * Math.PI) / 180;
            const x2 = (lon2 * Math.PI) / 180;
            const y2 = (lat2 * Math.PI) / 180;

            // Spherical excess approximation for small polygons
            area += (x2 - x1) * (2 + Math.sin(y1) + Math.sin(y2));
        }

        area = (area * R * R) / 2;
        return Math.abs(area);
    }

    private getColorForDensity(density: number): string {
        if (density === 0) return '#EEEEEE';

        // Viridis color scale points
        const viridisColors = [
            { threshold: 0, color: [68, 1, 84] },      // #440154 - dark purple
            { threshold: 0.2, color: [59, 82, 139] },  // #3b528b - blue
            { threshold: 0.4, color: [33, 145, 140] }, // #21918c - teal
            { threshold: 0.6, color: [94, 201, 98] },  // #5ec962 - green
            { threshold: 0.8, color: [253, 231, 37] }, // #fde725 - yellow
            { threshold: 1.0, color: [253, 231, 37] }  // #fde725 - yellow (cap)
        ];

        // Normalize density to 0-1 scale (adjust max as needed)
        const maxDensity = 10000;
        const normalizedDensity = Math.min(density / maxDensity, 1);

        // Find the two colors to interpolate between
        let lowerIndex = 0;
        for (let i = 0; i < viridisColors.length - 1; i++) {
            if (normalizedDensity >= viridisColors[i].threshold) {
                lowerIndex = i;
            }
        }

        const upperIndex = Math.min(lowerIndex + 1, viridisColors.length - 1);
        const lower = viridisColors[lowerIndex];
        const upper = viridisColors[upperIndex];

        // Calculate interpolation factor
        const range = upper.threshold - lower.threshold;
        const factor = range === 0 ? 0 : (normalizedDensity - lower.threshold) / range;

        // Interpolate RGB values
        const r = Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * factor);
        const g = Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * factor);
        const b = Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * factor);

        // Convert to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    private getColorForAge(meanAge: number | null): string {
        if (meanAge === null) return '#EEEEEE';

        const t = Math.max(0, Math.min(1, (meanAge - 25) / 30));
        const colors = [
            { pos: 0.00, color: [68, 1, 84] },
            { pos: 0.25, color: [59, 82, 139] },
            { pos: 0.50, color: [33, 145, 140] },
            { pos: 0.75, color: [94, 201, 98] },
            { pos: 1.00, color: [253, 231, 37] }
        ];

        for (let i = 0; i < colors.length - 1; i++) {
            if (t >= colors[i].pos && t <= colors[i + 1].pos) {
                const localT = (t - colors[i].pos) / (colors[i + 1].pos - colors[i].pos);
                const [r1, g1, b1] = colors[i].color;
                const [r2, g2, b2] = colors[i + 1].color;
                const r = Math.round(r1 + (r2 - r1) * localT);
                const g = Math.round(g1 + (g2 - g1) * localT);
                const b = Math.round(b1 + (b2 - b1) * localT);
                return `rgb(${r}, ${g}, ${b})`;
            }
        }

        return '#EEEEEE';
    }

    private getColorForGenderRatio(ratio: number | null): string {
        if (ratio === 0 || ratio === null || isNaN(ratio)) return '#EEEEEE'; // neutral background

        // Clamp ratio extremes to prevent crazy colors
        const clamped = Math.max(0.5, Math.min(2, ratio));

        // Map 0.5 → 0 (pink), 1 → 0.5 (neutral), 2 → 1 (blue)
        const t = (clamped - 0.5) / 1.5;

        // Define the gradient endpoints
        const pink = [255, 105, 180];  // HotPink
        const neutral = [240, 240, 240]; // light gray
        const blue = [70, 130, 180];   // SteelBlue

        let r: number, g: number, b: number;

        if (t < 0.5) {
            // Interpolate from pink → neutral
            const localT = t / 0.5;
            r = Math.round(pink[0] + (neutral[0] - pink[0]) * localT);
            g = Math.round(pink[1] + (neutral[1] - pink[1]) * localT);
            b = Math.round(pink[2] + (neutral[2] - pink[2]) * localT);
        } else {
            // Interpolate from neutral → blue
            const localT = (t - 0.5) / 0.5;
            r = Math.round(neutral[0] + (blue[0] - neutral[0]) * localT);
            g = Math.round(neutral[1] + (blue[1] - neutral[1]) * localT);
            b = Math.round(neutral[2] + (blue[2] - neutral[2]) * localT);
        }

        return `rgb(${r}, ${g}, ${b})`;
    }
}