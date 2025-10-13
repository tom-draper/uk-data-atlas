// lib/utils/mapManager.ts
import mapboxgl from 'mapbox-gl';
import { LocationBounds, ChartData, WardData, Party } from '@/lib/types';

interface MapManagerCallbacks {
    onWardHover: (params: { data: WardData | null; wardCode: string }) => void;
    onLocationChange: (stats: ChartData, location: LocationBounds) => void;
}

export class MapManager {
    private map: mapboxgl.Map;
    private callbacks: MapManagerCallbacks;
    private lastHoveredFeatureId: any = null;
    private cache: Record<string, ChartData> = {};

    constructor(map: mapboxgl.Map, callbacks: MapManagerCallbacks) {
        this.map = map;
        this.callbacks = callbacks;
    }

    calculateAndCacheLocation(
        location: LocationBounds,
        geoData: any,
        wardData: Record<string, WardData>,
        year: string = ''
    ): ChartData {
        const key = location.name + year;
        if (this.cache[key]) {
            console.log('Using cached data for', key);
            return this.cache[key];
        }

        // Aggregate stats for all wards within this location
        const wardsInLocation = geoData.features.filter((f: any) =>
            location.lad_codes.includes(f.properties.LAD24CD)
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
            const code = f.properties.WD24CD;
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

        this.cache[location.name] = aggregated;
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
        const filteredFeatures = geoData.features.filter((f: any) =>
            location.lad_codes.includes(f.properties.LAD24CD)
        );

        const locationData = {
            type: 'FeatureCollection' as const,
            features: filteredFeatures.map((feature: any) => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    winningParty: wardResults[feature.properties.WD24CD] || 'NONE'
                }
            }))
        };

        this.removeExistingLayers();
        this.addSource(locationData);
        this.addLayers(partyInfo);
        this.setupEventHandlers(location, geoData, wardData);

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
        wardData: Record<string, WardData>
    ) {
        this.map.on('mousemove', 'wards-fill', (e) => {
            this.map.getCanvas().style.cursor = 'pointer';

            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                this.handleFeatureHover(feature, wardData);
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

    private handleFeatureHover(feature: any, wardData: Record<string, WardData>) {
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

        const wardCode = feature.properties.WD24CD;
        const wardDataForCode = wardData[wardCode];

        if (wardDataForCode) {
            this.callbacks.onWardHover({ data: wardDataForCode, wardCode: wardCode });
        } else {
            this.callbacks.onWardHover({ data: null, wardCode: wardCode });
        }
    }
}