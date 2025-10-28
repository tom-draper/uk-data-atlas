// lib/utils/mapManager.ts
import { LocationBounds, ChartData, WardData, Party } from '@lib/types';
import { WardGeojson } from '@lib/hooks/useWardDatasets';
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
    buildWardToLadMapping(geojson: WardGeojson): void {
        const wardCodeProp = this.detectWardCodeProperty(geojson);
        const locationCodeInfo = this.detectLocationCodeProperty(geojson);

        // Only build mapping if LAD codes exist
        if (!locationCodeInfo.fallbackToWardMapping && locationCodeInfo.property) {
            console.log(`Building ward-to-LAD mapping from ${wardCodeProp} -> ${locationCodeInfo.property}`);
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

    private detectWardCodeProperty(geojson: WardGeojson): string {
        const firstFeature = geojson.features[0];
        if (!firstFeature) return 'WD24CD';

        const props = firstFeature.properties;
        return props.WD23CD ? 'WD23CD'
            : props.WD22CD ? 'WD22CD'
                : props.WD21CD ? 'WD21CD'
                    : 'WD24CD';
    }

    private detectLocationCodeProperty(geojson: WardGeojson): {
        property: string | null;
        fallbackToWardMapping: boolean
    } {
        const firstFeature = geojson.features[0];
        if (!firstFeature) return { property: 'LAD24CD', fallbackToWardMapping: false };

        const props = firstFeature.properties;

        // Check for LAD codes
        if (props.LAD24CD) return { property: 'LAD24CD', fallbackToWardMapping: false };
        if (props.LAD23CD) return { property: 'LAD23CD', fallbackToWardMapping: false };
        if (props.LAD22CD) return { property: 'LAD22CD', fallbackToWardMapping: false };
        if (props.LAD21CD) return { property: 'LAD21CD', fallbackToWardMapping: false };

        // No LAD codes found - we'll need to use ward code mapping
        return { property: null, fallbackToWardMapping: true };
    }

    private getWardsInLocation(geojson: WardGeojson, location: LocationBounds) {
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

    calculateLocationStats(
        location: LocationBounds,
        geojson: WardGeojson,
        wardData: Record<string, WardData>,
        year: string = ''
    ): ChartData {
        const cacheKey = `${location.name}-${year}`
        if (this.cache.has(cacheKey)) {
            console.log('calculateLocationStats cache hit:', cacheKey);
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
        geojson: WardGeojson,
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