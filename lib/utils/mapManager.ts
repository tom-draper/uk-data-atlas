// lib/utils/mapManager.ts
import mapboxgl from 'mapbox-gl';
import { LocationBounds, ChartData, WardData } from '@lib/types';
import { PARTY_COLORS } from '@lib/data/parties';

interface MapManagerCallbacks {
    onWardHover: (wardData: WardData | null, wardName: string, wardCode: string) => void;
    onLocationChange: (stats: ChartData, location: LocationBounds) => void;
}

export class MapManager {
    private map: mapboxgl.Map;
    private callbacks: MapManagerCallbacks;
    private lastHoveredFeatureId: any = null;

    constructor(map: mapboxgl.Map, callbacks: MapManagerCallbacks) {
        this.map = map;
        this.callbacks = callbacks;
    }

    updateMapForLocation(
        location: LocationBounds,
        geoData: any,
        wardResults: Record<string, string>,
        wardData: Record<string, WardData>,
        locationStats: ChartData
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
        this.addLayers();
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

    private addLayers() {
        this.map.addLayer({
            id: 'wards-fill',
            type: 'fill',
            source: 'location-wards',
            paint: {
                'fill-color': [
                    'match',
                    ['get', 'winningParty'],
                    'LAB', PARTY_COLORS.LAB,
                    'CON', PARTY_COLORS.CON,
                    'LD', PARTY_COLORS.LD,
                    'GREEN', PARTY_COLORS.GREEN,
                    'REF', PARTY_COLORS.REF,
                    'IND', PARTY_COLORS.IND,
                    PARTY_COLORS.NONE
                ],
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
            this.callbacks.onWardHover(null, '', '');
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
        const data = wardData[wardCode];

        if (data) {
            this.callbacks.onWardHover(
                data,
                data.wardName as string,
                wardCode
            );
        }
    }
}
