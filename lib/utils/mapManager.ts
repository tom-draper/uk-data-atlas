// lib/utils/mapManager.ts
import { LocationBounds, ChartData, WardData, Party } from '@/lib/types';
import { WardGeojson } from '../hooks/useWardDatasets';

interface MapManagerCallbacks {
    onWardHover: (params: { data: WardData | null; wardCode: string }) => void;
    onLocationChange: (stats: ChartData, location: LocationBounds) => void;
}

export class MapManager {
    private map: mapboxgl.Map;
    private callbacks: MapManagerCallbacks;
    private lastHoveredFeatureId: any = null;
    private cache = new Map();

    constructor(map: mapboxgl.Map, callbacks: MapManagerCallbacks) {
        this.map = map;
        this.callbacks = callbacks;
    }

    private detectWardCodeProperty(geoData: any): string {
        const firstFeature = geoData.features[0];
        if (!firstFeature) return 'WD24CD';

        return firstFeature.properties.WD23CD ? 'WD23CD'
            : firstFeature.properties.WD22CD ? 'WD22CD'
                : firstFeature.properties.WD21CD ? 'WD21CD'
                    : 'WD24CD';
    }

    private detectLocationCodeProperty(geoData: any): string {
        const firstFeature = geoData.features[0];
        if (!firstFeature) return 'LAD24CD';

        return firstFeature.properties.WD23CD ? 'LAD23CD'
            : firstFeature.properties.WD22CD ? 'LAD22CD'
                : firstFeature.properties.WD21CD ? 'LAD21CD'
                    : 'LAD24CD';
    }

    calculateLocationStats(
        location: LocationBounds,
        geoData: WardGeojson,
        wardData: Record<string, WardData>,
        year: string = ''
    ): ChartData {
        const cacheKey = `${location.name}-${year}`
        console.log(cacheKey)
        if (this.cache.has(cacheKey)) {
            console.log('using cache')
            return this.cache.get(cacheKey)
        }

        console.log('Calculate location stats')
        // Detect the correct ward code property based on the geojson
        const wardCodeProp = this.detectWardCodeProperty(geoData);
        const locationCodeProp = this.detectLocationCodeProperty(geoData);

        // Aggregate stats for all wards within this location
        const wardsInLocation = geoData.features.filter((f: any) => 
            location.lad_codes.includes(f.properties[locationCodeProp])
        );

        const aggregated: ChartData = {
            LAB: 0,
            CON: 0,
            LD: 0,
            GREEN: 0,
            REF: 0,
            IND: 0,
        };

        wardsInLocation.forEach((f: any) => {
            // Use the detected ward code property instead of hardcoded WD24CD
            const code = f.properties[wardCodeProp];
            const ward = wardData[code];
            if (ward) {
                // Assuming ward has party vote counts
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
        geoData: any,
        wardResults: Record<string, string>,
        wardData: Record<string, WardData>,
        locationStats: ChartData,
        partyInfo: Party[]
    ) {
        console.log('Update map for location')
        const wardCodeProp = this.detectWardCodeProperty(geoData);
        const locationCodeProp = this.detectLocationCodeProperty(geoData);

        // Sample a few codes from the first filtered feature
        const filteredFeatures = geoData.features.filter((f: any) => {
            return location.lad_codes.includes(f.properties[locationCodeProp])
        });

        const locationData = {
            type: 'FeatureCollection' as const,
            features: filteredFeatures.map((feature: any) => ({
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
        this.setupEventHandlers(location, geoData, wardData, wardCodeProp);

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
            colorExpression.push(party.key, party.color);
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