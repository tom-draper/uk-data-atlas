// lib/utils/mapManager/EventHandler.ts
import { GeoJSONFeature } from 'mapbox-gl';
import { MapManagerCallbacks, MapMode } from './mapManager';

const SOURCE_ID = 'location-wards';
const FILL_LAYER_ID = 'wards-fill';

export class EventHandler {
    private lastHoveredFeatureId: any = null;

    constructor(
        private map: mapboxgl.Map,
        private callbacks: MapManagerCallbacks
    ) {}

    setupEventHandlers(mode: MapMode, data: any, codeProp: string): void {
        // Remove existing handlers
        this.map.off('mousemove', FILL_LAYER_ID);
        this.map.off('mouseleave', FILL_LAYER_ID);

        // Setup mousemove handler
        this.map.on('mousemove', FILL_LAYER_ID, (e) => {
            if (!e.features?.length) return;

            this.map.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0];
            this.updateHoverState(feature);

            const code = feature.properties[codeProp];
            const locationData = data[code];

            this.handleHover(mode, code, locationData);
        });

        // Setup mouseleave handler
        this.map.on('mouseleave', FILL_LAYER_ID, () => {
            this.clearHoverState();
            this.map.getCanvas().style.cursor = '';
            this.handleMouseLeave(mode);
        });
    }

    private handleHover(mode: MapMode, code: string, locationData: any): void {
        switch (mode) {
            case 'general-election':
                this.callbacks.onConstituencyHover?.(locationData || null);
                break;
            case 'population':
                this.handlePopulationHover(code, locationData);
                break;
            default:
                this.callbacks.onWardHover?.({ data: locationData || null, wardCode: code });
        }
    }

    private handleMouseLeave(mode: MapMode): void {
        if (mode === 'general-election') {
            this.callbacks.onConstituencyHover?.(null);
        } else {
            this.callbacks.onWardHover?.({ data: null, wardCode: '' });
        }
    }

    private handlePopulationHover(wardCode: string, wardPopData: any): void {
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

    private updateHoverState(feature: GeoJSONFeature): void {
        if (this.lastHoveredFeatureId !== null && this.lastHoveredFeatureId !== feature.id) {
            this.map.setFeatureState(
                { source: SOURCE_ID, id: this.lastHoveredFeatureId },
                { hover: false }
            );
        }

        this.map.setFeatureState(
            { source: SOURCE_ID, id: feature.id },
            { hover: true }
        );
        this.lastHoveredFeatureId = feature.id;
    }

    private clearHoverState(): void {
        if (this.lastHoveredFeatureId !== null) {
            this.map.setFeatureState(
                { source: SOURCE_ID, id: this.lastHoveredFeatureId },
                { hover: false }
            );
            this.lastHoveredFeatureId = null;
        }
    }
}