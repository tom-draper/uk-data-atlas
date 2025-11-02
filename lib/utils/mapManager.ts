// lib/utils/mapManager.ts
import { LocationBounds, ChartData, WardData, Party, PopulationWardData, BoundaryGeojson } from '@lib/types';
import { PARTY_COLORS } from '../data/parties';

interface MapManagerCallbacks {
    onWardHover: (params: { data: WardData | null; wardCode: string }) => void;
    onLocationChange: (stats: ChartData, location: LocationBounds) => void;
}

export class MapManager {
    private map: mapboxgl.Map;
    private callbacks: MapManagerCallbacks;
    private lastHoveredFeatureId: any = null;
    private cache = new Map();
    private wardToLadMapping = new Map<string, string>(); // Ward code -> LAD code mapping

    constructor(map: mapboxgl.Map, callbacks: MapManagerCallbacks) {
        this.map = map;
        this.callbacks = callbacks;
    }

    /**
     * Build a mapping of ward codes to LAD codes from GeoJSON that contains both
     * This should be called whenever you have GeoJSON with LAD codes
     */
    buildWardToLadMapping(geojson: BoundaryGeojson): void {
        const wardCodeProp = this.detectWardCodeProperty(geojson);
        const locationCodeInfo = this.detectLocationCodeProperty(geojson);

        // Only build mapping if LAD codes exist
        if (!locationCodeInfo.fallbackToWardMapping && locationCodeInfo.property) {
            let mappedCount = 0;

            geojson.features.forEach((feature: any) => {
                const wardCode = feature.properties[wardCodeProp];
                const ladCode = feature.properties[locationCodeInfo.property!];

                if (wardCode && ladCode) {
                    this.wardToLadMapping.set(wardCode, ladCode);
                    mappedCount++;
                }
            });
        }
    }

    private detectWardCodeProperty(geojson: BoundaryGeojson) {
        const wardCodeKeys = ['WD24CD', 'WD23CD', 'WD22CD', 'WD21CD'];
        const firstFeature = geojson.features[0];
        if (!firstFeature) return wardCodeKeys[0];

        const props = firstFeature.properties as Record<string, unknown>;

        // Check each in order of newest to oldest
        const match = wardCodeKeys.find(key => key in props);
        return match ?? wardCodeKeys[0];
    }

    private detectLocationCodeProperty(geojson: BoundaryGeojson): {
        property: string | null;
        fallbackToWardMapping: boolean;
    } {
        const ladCodeKeys = ['LAD24CD', 'LAD23CD', 'LAD22CD', 'LAD21CD'];
        const firstFeature = geojson.features[0];
        if (!firstFeature) return { property: ladCodeKeys[0], fallbackToWardMapping: false };

        const props = firstFeature.properties as Record<string, unknown>;

        const ladMatch = ladCodeKeys.find(key => key in props);
        if (ladMatch) {
            return { property: ladMatch, fallbackToWardMapping: false };
        }

        // No LAD codes found → fallback
        return { property: null, fallbackToWardMapping: true };
    }

    private getWardsInLocation(geojson: BoundaryGeojson, location: LocationBounds) {
        const locationCodeInfo = this.detectLocationCodeProperty(geojson);
        const wardCodeProp = this.detectWardCodeProperty(geojson);

        let wardsInLocation: any[];
        if (locationCodeInfo.fallbackToWardMapping) {
            wardsInLocation = geojson.features.filter((f: any) => {
                const locationCode = this.wardToLadMapping.get(f.properties[wardCodeProp]);
                return location.lad_codes.includes(locationCode || '');
            });
        } else {
            wardsInLocation = geojson.features.filter((f: any) => {
                const locationCode = f.properties[locationCodeInfo.property!];
                return location.lad_codes.includes(locationCode);
            });
        }

        return wardsInLocation;
    }

    /**
 * Calculate mean age for a ward's population
 */
    private calculateMeanAge(wardPopulation: any): number {
        if (!wardPopulation?.total) return 45;

        const ageData = wardPopulation.total;
        let totalPop = 0;
        let weightedSum = 0;

        for (let age = 0; age <= 90; age++) {
            const count = ageData[age] || 0;
            totalPop += count;
            weightedSum += age * count;
        }

        return totalPop > 0 ? weightedSum / totalPop : 45;
    }

    // In updateMapForPopulation, change:
    // const meanAge = this.calculateMeanAge(wardPopulation);
    // ... properties: { ..., meanAge: meanAge, color: this.getColorForAge(meanAge) }

    // Viridis colors (purple->blue->green->yellow)
    private getColorForAge(meanAge: number | null): string {
        if (meanAge === null) return 'rgb(253, 253, 253)'; // Default color for missing data

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

    /**
     * Calculate median age for a ward's population
     */
    private calculateMedianAge(wardPopulation: any): number | null {
        if (!wardPopulation?.total) return null; // Default fallback

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

        return null; // Fallback
    }

    /**
     * Get color for a given median age using continuous scale
     * Purple (young) -> Red (old)
     */
    private getColorForMedianAge(medianAge: number): string {
        // Clamp age between 0-90
        const clampedAge = Math.max(0, Math.min(90, medianAge));

        // Normalize to 0-1
        const t = clampedAge / 90;

        // Interpolate from purple to red via blue, green, yellow
        if (t < 0.25) {
            // Purple to Blue
            const localT = t / 0.25;
            return this.interpolateColor('#4a148c', '#1976d2', localT);
        } else if (t < 0.5) {
            // Blue to Green
            const localT = (t - 0.25) / 0.25;
            return this.interpolateColor('#1976d2', '#388e3c', localT);
        } else if (t < 0.75) {
            // Green to Orange
            const localT = (t - 0.5) / 0.25;
            return this.interpolateColor('#388e3c', '#f57c00', localT);
        } else {
            // Orange to Red
            const localT = (t - 0.75) / 0.25;
            return this.interpolateColor('#f57c00', '#c62828', localT);
        }
    }

    private interpolateColor(color1: string, color2: string, t: number): string {
        const r1 = parseInt(color1.slice(1, 3), 16);
        const g1 = parseInt(color1.slice(3, 5), 16);
        const b1 = parseInt(color1.slice(5, 7), 16);

        const r2 = parseInt(color2.slice(1, 3), 16);
        const g2 = parseInt(color2.slice(3, 5), 16);
        const b2 = parseInt(color2.slice(5, 7), 16);

        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    /**
     * Update map to show population age heatmap
     */
    updateMapForPopulation(
        location: LocationBounds,
        geojson: BoundaryGeojson,
        populationData: PopulationWardData
    ) {
        const wardsInLocation = this.getWardsInLocation(geojson, location);
        const wardCodeProp = this.detectWardCodeProperty(geojson);

        console.log('EXPENSIVE: updateMapForPopulation: Filtered wards', wardsInLocation);

        // Calculate median age for each ward and add to properties
        const locationData = {
            type: 'FeatureCollection' as const,
            features: wardsInLocation.map((feature: any) => {
                const wardCode = feature.properties[wardCodeProp];
                const wardPopulation = populationData[wardCode];
                const medianAge = this.calculateMedianAge(wardPopulation);
                // const meanAge = this.calculateMeanAge(wardPopulation);


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
        this.setupPopulationEventHandlers(location, geojson, populationData, wardCodeProp);
        this.buildWardToLadMapping(geojson);

        // Dummy chart data for population mode
        const dummyStats: ChartData = { LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0 };
        this.callbacks.onLocationChange(dummyStats, location);
    }

    /**
     * Add map layers for population heatmap
     */
    private addPopulationLayers() {
        this.map.addLayer({
            id: 'wards-fill',
            type: 'fill',
            source: 'location-wards',
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
            id: 'wards-line',
            type: 'line',
            source: 'location-wards',
            paint: {
                'line-color': '#000',
                'line-width': 1,
                'line-opacity': 0.05
            }
        });
    }

    /**
     * Setup event handlers for population mode
     */
    private setupPopulationEventHandlers(
        location: LocationBounds,
        geoData: any,
        populationData: PopulationWardData,
        wardCodeProp: string
    ) {
        this.map.on('mousemove', 'wards-fill', (e) => {
            this.map.getCanvas().style.cursor = 'pointer';

            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                this.handlePopulationFeatureHover(feature, populationData, wardCodeProp);
            }
        });

        this.map.on('mouseleave', 'wards-fill', () => {
            if (this.lastHoveredFeatureId !== null) {
                this.map.setFeatureState(
                    { source: 'location-wards', id: this.lastHoveredFeatureId },
                    { hover: false }
                );
            }
            this.map.getCanvas().style.cursor = '';
            this.callbacks.onWardHover({ data: null, wardCode: '' });
        });
    }

    /**
     * Handle feature hover in population mode
     */
    private handlePopulationFeatureHover(
        feature: any,
        populationData: PopulationWardData,
        wardCodeProp: string
    ) {
        if (this.lastHoveredFeatureId !== null && this.lastHoveredFeatureId !== feature.id) {
            this.map.setFeatureState(
                { source: 'location-wards', id: this.lastHoveredFeatureId },
                { hover: false }
            );
        }

        this.map.setFeatureState(
            { source: 'location-wards', id: feature.id },
            { hover: true }
        );
        this.lastHoveredFeatureId = feature.id;

        const wardCode = feature.properties[wardCodeProp];
        const wardPopData = populationData[wardCode];

        if (wardPopData) {
            // Create a WardData-like object for the callback
            const wardData: WardData = {
                wardCode: wardCode,
                wardName: wardPopData.wardName || '',
                localAuthorityCode: wardPopData.laCode || '',
                localAuthorityName: wardPopData.laName || '',
                // Add dummy election data
                LAB: 0,
                CON: 0,
                LD: 0,
                GREEN: 0,
                REF: 0,
                IND: 0
            };
            this.callbacks.onWardHover({ data: wardData, wardCode: wardCode });
        } else {
            this.callbacks.onWardHover({ data: null, wardCode: wardCode });
        }
    }

    calculateLocationStats(
        location: LocationBounds,
        geojson: BoundaryGeojson,
        wardData: Record<string, WardData>,
        year: string = ''
    ): ChartData {
        const cacheKey = `${location.name}-${year}`
        if (this.cache.has(cacheKey)) {
            console.log(`CACHE HIT: calculateLocationStats: [${cacheKey}]`);
            return this.cache.get(cacheKey)
        }

        const wardsInLocation = this.getWardsInLocation(geojson, location);

        console.log(`EXPENSIVE: calculateLocationStats: [${cacheKey}] Filtered ${wardsInLocation.length} wards`);

        const aggregated: ChartData = {
            LAB: 0,
            CON: 0,
            LD: 0,
            GREEN: 0,
            REF: 0,
            IND: 0,
        };

        const wardCodeProp = this.detectWardCodeProperty(geojson);
        wardsInLocation.forEach((f: any) => {
            const code = f.properties[wardCodeProp];
            const ward = wardData[code];
            if (ward) {
                aggregated.LAB += (ward.LAB as number) || 0;
                aggregated.CON += (ward.CON as number) || 0;
                aggregated.LD += (ward.LD as number) || 0;
                aggregated.GREEN += (ward.GREEN as number) || 0;
                aggregated.REF += (ward.REF as number) || 0;
                aggregated.IND += (ward.IND as number) || 0;
            }
        });

        this.cache.set(cacheKey, aggregated);
        return aggregated;
    }

    updateMapForLocation(
        location: LocationBounds,
        geojson: BoundaryGeojson,
        wardResults: Record<string, string>,
        wardData: Record<string, WardData>,
        locationStats: ChartData,
        partyInfo: Party[]
    ) {
        const wardsInLocation = this.getWardsInLocation(geojson, location);

        console.log('EXPENSIVE: updateMapForLocation: Filtered wards', wardsInLocation);

        const wardCodeProp = this.detectWardCodeProperty(geojson);
        const locationData = {
            type: 'FeatureCollection' as const,
            features: wardsInLocation.map((feature: any) => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    winningParty: wardResults[feature.properties[wardCodeProp]] || 'NONE'
                }
            }))
        };

        this.removeExistingLayers();
        this.addSource(locationData);
        this.addLayers(partyInfo);
        this.setupEventHandlers(location, geojson, wardData, wardCodeProp);
        this.buildWardToLadMapping(geojson);

        this.callbacks.onLocationChange(locationStats, location);
    }

    private removeExistingLayers() {
        if (this.map.getSource('location-wards')) {
            if (this.map.getLayer('wards-fill')) this.map.removeLayer('wards-fill');
            if (this.map.getLayer('wards-line')) this.map.removeLayer('wards-line');
            this.map.removeSource('location-wards');
        }
    }

    private addSource(locationData: any) {
        this.map.addSource('location-wards', {
            type: 'geojson',
            data: locationData
        });
    }

    private addLayers(partyInfo: Party[]) {
        // Build color match expression from partyInfo
        const colorExpression: any[] = ['match', ['get', 'winningParty']];

        partyInfo.forEach(party => {
            colorExpression.push(party.key, PARTY_COLORS[party.key]);
        });

        // Default color for no winner
        colorExpression.push('#cccccc');

        this.map.addLayer({
            id: 'wards-fill',
            type: 'fill',
            source: 'location-wards',
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
            id: 'wards-line',
            type: 'line',
            source: 'location-wards',
            paint: {
                'line-color': '#000',
                'line-width': 1,
                'line-opacity': 0.05
            }
        });
    }

    private setupEventHandlers(
        location: LocationBounds,
        geoData: any,
        wardData: Record<string, WardData>,
        wardCodeProp: string = 'WD24CD'
    ) {
        this.map.on('mousemove', 'wards-fill', (e) => {
            this.map.getCanvas().style.cursor = 'pointer';

            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                this.handleFeatureHover(feature, wardData, wardCodeProp);
            }
        });

        this.map.on('mouseleave', 'wards-fill', () => {
            if (this.lastHoveredFeatureId !== null) {
                this.map.setFeatureState(
                    { source: 'location-wards', id: this.lastHoveredFeatureId },
                    { hover: false }
                );
            }
            this.map.getCanvas().style.cursor = '';
            this.callbacks.onWardHover({ data: null, wardCode: '' });
        });
    }

    private handleFeatureHover(feature: any, wardData: Record<string, WardData>, wardCodeProp: string = 'WD24CD') {
        if (this.lastHoveredFeatureId !== null && this.lastHoveredFeatureId !== feature.id) {
            this.map.setFeatureState(
                { source: 'location-wards', id: this.lastHoveredFeatureId },
                { hover: false }
            );
        }

        this.map.setFeatureState(
            { source: 'location-wards', id: feature.id },
            { hover: true }
        );
        this.lastHoveredFeatureId = feature.id;

        const wardCode = feature.properties[wardCodeProp];
        const wardDataForCode = wardData[wardCode];

        if (wardDataForCode) {
            this.callbacks.onWardHover({ data: wardDataForCode, wardCode: wardCode });
        } else {
            this.callbacks.onWardHover({ data: null, wardCode: wardCode });
        }
    }
}