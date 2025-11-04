// lib/utils/mapManager.ts
import { ChartData, WardData, Party, PopulationWardData, BoundaryGeojson } from '@lib/types';
import { PARTY_COLORS } from '../data/parties';
import { LOCATIONS } from '../data/locations';

interface ConstituencyData {
    onsId: string;
    constituencyName: string;
    regionName: string;
    countryName: string;
    [key: string]: any;
}

interface MapManagerCallbacks {
    onWardHover?: (params: { data: WardData | null; wardCode: string }) => void;
    onConstituencyHover?: (data: ConstituencyData | null) => void;
    onLocationChange: (stats: ChartData, location: string) => void;
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
     * Detect constituency code property from GeoJSON
     */
    private detectConstituencyCodeProperty(geojson: BoundaryGeojson): string {
        const constituencyCodeKeys = ['PCON24CD', 'PCON25CD'];
        const firstFeature = geojson.features[0];
        if (!firstFeature) return constituencyCodeKeys[0];

        const props = firstFeature.properties as Record<string, unknown>;
        const match = constituencyCodeKeys.find(key => key in props);
        return match ?? constituencyCodeKeys[0];
    }

    /**
     * Get constituencies in a location
     * For constituencies, we filter by checking if the constituency's region/country matches
     * or if it intersects with the location bounds
     */
    private getConstituenciesInLocation(geojson: BoundaryGeojson, location: string) {
        // Check if this is actually constituency data by looking at the properties
        const firstFeature = geojson.features[0];
        if (!firstFeature) return [];

        console.log('All properties:', firstFeature.properties);
        console.log(location)

        const constituenciesInLocation = geojson.features.filter((f: any) => true);
        return constituenciesInLocation;
    }

    /**
     * Update map to show constituency election results
     */
    updateMapForGeneralElectionLocation(
        location: string,
        geojson: BoundaryGeojson,
        constituencyResults: Record<string, string>, // onsId -> party
        constituencyData: Record<string, ConstituencyData>,
        partyInfo: Party[]
    ) {
        const constituenciesInLocation = this.getConstituenciesInLocation(geojson, location);
        const constituencyCodeProp = this.detectConstituencyCodeProperty(geojson);

        console.log('EXPENSIVE: updateMapForConstituencies');
        console.log('- Geojson feature count:', geojson.features.length);
        console.log('- Filtered constituencies:', constituenciesInLocation.length);
        console.log('- Constituency code property:', constituencyCodeProp);
        console.log('- Sample constituency codes from geojson:', constituenciesInLocation.slice(0, 3).map((f: any) => f.properties[constituencyCodeProp]));
        console.log('- Sample constituency codes from data:', Object.keys(constituencyData).slice(0, 3));
        console.log('- Total constituencies in data:', Object.keys(constituencyData).length);

        const locationData = {
            type: 'FeatureCollection' as const,
            features: constituenciesInLocation.map((feature: any) => {
                const onsId = feature.properties[constituencyCodeProp];
                const winningParty = constituencyResults[onsId] || 'NONE';
                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        winningParty
                    }
                };
            })
        };

        console.log('- Sample winning parties:', locationData.features.slice(0, 3).map((f: any) => ({
            id: f.properties[constituencyCodeProp],
            party: f.properties.winningParty
        })));

        this.removeExistingLayers();
        this.addSource(locationData);
        this.addLayers(partyInfo);
        this.setupConstituencyEventHandlers(constituencyData, constituencyCodeProp);

        // Calculate dummy stats for constituencies
        const dummyStats: ChartData = { LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0 };
        this.callbacks.onLocationChange(dummyStats, location);
    }

    /**
     * Setup event handlers for constituency hover
     */
    private setupConstituencyEventHandlers(
        constituencyData: Record<string, ConstituencyData>,
        constituencyCodeProp: string
    ) {
        this.map.on('mousemove', 'wards-fill', (e) => {
            this.map.getCanvas().style.cursor = 'pointer';

            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                this.handleConstituencyFeatureHover(feature, constituencyData, constituencyCodeProp);
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
            if (this.callbacks.onConstituencyHover) {
                this.callbacks.onConstituencyHover(null);
            }
        });
    }

    /**
     * Handle constituency hover
     */
    private handleConstituencyFeatureHover(
        feature: any,
        constituencyData: Record<string, ConstituencyData>,
        constituencyCodeProp: string
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

        const onsId = feature.properties[constituencyCodeProp];

        const constData = constituencyData[onsId];

        if (constData && this.callbacks.onConstituencyHover) {
            this.callbacks.onConstituencyHover(constData);
        } else if (this.callbacks.onConstituencyHover) {
            this.callbacks.onConstituencyHover(null);
        }
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

    private getWardsInLocation(geojson: BoundaryGeojson, location: string) {
        const locationCodeInfo = this.detectLocationCodeProperty(geojson);
        const wardCodeProp = this.detectWardCodeProperty(geojson);

        const lad_codes = LOCATIONS[location]?.lad_codes;

        let wardsInLocation: any[];
        if (locationCodeInfo.fallbackToWardMapping) {
            wardsInLocation = geojson.features.filter((f: any) => {
                const locationCode = this.wardToLadMapping.get(f.properties[wardCodeProp]);
                return lad_codes.includes(locationCode || '');
            });
        } else {
            wardsInLocation = geojson.features.filter((f: any) => {
                const locationCode = f.properties[locationCodeInfo.property!];
                return lad_codes.includes(locationCode);
            });
        }

        return wardsInLocation;
    }

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
     * Update map to show population age heatmap
     */
    updateMapForPopulationLocation(
        location: string,
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
        this.setupPopulationEventHandlers(populationData, wardCodeProp);
        this.buildWardToLadMapping(geojson);

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
            if (this.callbacks.onWardHover) {
                this.callbacks.onWardHover({ data: null, wardCode: '' });
            }
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

        if (wardPopData && this.callbacks.onWardHover) {
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
        } else if (this.callbacks.onWardHover) {
            this.callbacks.onWardHover({ data: null, wardCode: wardCode });
        }
    }

    calculateLocalElectionLocationStats(
        location: string,
        geojson: BoundaryGeojson,
        wardData: Record<string, WardData>,
        year: string = ''
    ): ChartData {
        const cacheKey = `local-election-${location}-${year}`
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

    updateMapForLocalElectionLocation(
        location: string,
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
        this.setupEventHandlers(wardData, wardCodeProp);
        this.buildWardToLadMapping(geojson);

        this.callbacks.onLocationChange(locationStats, location);
    }


    /**
     * Calculate aggregated constituency stats for a location
     */
    calculateConstituencyStats(
        location: string,
        geojson: BoundaryGeojson,
        constituencyData: Record<string, any>, // onsId -> { LAB, CON, LD, etc. }
        year: string = ''
    ): {
        totalSeats: number;
        partySeats: Record<string, number>;
        totalVotes: number;
        partyVotes: Record<string, number>;
    } {
        const cacheKey = `general-election-${location}-${year}`;
        if (this.cache.has(cacheKey)) {
            console.log(`CACHE HIT: calculateConstituencyStats: [${cacheKey}]`);
            return this.cache.get(cacheKey);
        }

        const constituenciesInLocation = this.getConstituenciesInLocation(geojson, location);
        const constituencyCodeProp = this.detectConstituencyCodeProperty(geojson);

        console.log(`EXPENSIVE: calculateConstituencyStats: [${cacheKey}] Filtered ${constituenciesInLocation.length} constituencies`);

        const aggregated = {
            totalSeats: 0,
            partySeats: {} as Record<string, number>,
            totalVotes: 0,
            partyVotes: {} as Record<string, number>,
        };

        // Party keys to aggregate (matching the data structure)
        const partyKeys = ['LAB', 'CON', 'LD', 'GREEN', 'RUK', 'SNP', 'PC', 'DUP', 'SF', 'OTHER'];

        constituenciesInLocation.forEach((feature: any) => {
            const onsId = feature.properties[constituencyCodeProp];
            const data = constituencyData[onsId];

            if (!data) {
                return;
            }

            aggregated.totalSeats += 1;

            // Find winning party by highest vote count
            let winningParty = '';
            let maxVotes = 0;
            partyKeys.forEach(party => {
                const votes = data[party] || 0;
                if (votes > maxVotes) {
                    maxVotes = votes;
                    winningParty = party;
                }
            });

            // Count seat for winning party
            if (winningParty) {
                aggregated.partySeats[winningParty] = (aggregated.partySeats[winningParty] || 0) + 1;
            }

            // Aggregate votes
            partyKeys.forEach(party => {
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
            if (this.callbacks.onWardHover) {
                this.callbacks.onWardHover({ data: null, wardCode: '' });
            }
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

        if (wardDataForCode && this.callbacks.onWardHover) {
            this.callbacks.onWardHover({ data: wardDataForCode, wardCode: wardCode });
        } else if (this.callbacks.onWardHover) {
            this.callbacks.onWardHover({ data: null, wardCode: wardCode });
        }
    }
}