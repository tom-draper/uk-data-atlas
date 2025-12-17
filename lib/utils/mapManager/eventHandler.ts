import type { MapMouseEvent } from 'mapbox-gl';
import type { MapLibreEvent } from 'maplibre-gl';
import { MapManagerCallbacks, MapMode } from './mapManager';
import { BoundaryType } from '@/lib/types';

const SOURCE_ID = 'location-wards';
const FILL_LAYER_ID = 'wards-fill';

type MapMouseEventType = MapMouseEvent | MapLibreEvent;

// Map mode to area type
const MODE_TO_BOUNDARY_TYPE: Record<MapMode, BoundaryType> = {
    generalElection: 'constituency',
    crime: 'localAuthority',
    income: 'localAuthority',
    ethnicity: 'localAuthority',
    population: 'ward',
    localElection: 'ward',
    housePrice: 'ward'
};

export class EventHandler {
    private lastHoveredFeatureId: string | number | null = null;
    private mouseMoveHandler: ((e: MapMouseEventType & { features?: any[] }) => void) | null = null;
    private mouseLeaveHandler: (() => void) | null = null;
    private currentData: Record<string, any> | null = null;
    private currentCodeProp: string = '';
    private currentBoundaryType: BoundaryType = 'ward';
    private canvas: HTMLCanvasElement;

    constructor(
        private map: mapboxgl.Map | maplibregl.Map,
        private callbacks: MapManagerCallbacks
    ) {
        this.canvas = this.map.getCanvas();
    }

    setupEventHandlers(mode: MapMode, data: any, codeProp: string): void {
        this.currentData = data;
        this.currentCodeProp = codeProp;
        this.currentBoundaryType = MODE_TO_BOUNDARY_TYPE[mode];
        
        this.removeHandlers();
        this.createHandlers();
        
        this.map.on('mousemove', FILL_LAYER_ID, this.mouseMoveHandler!);
        this.map.on('mouseleave', FILL_LAYER_ID, this.mouseLeaveHandler!);
    }

    private createHandlers(): void {
        this.mouseMoveHandler = (e: MapMouseEventType & { features?: any[] }) => {
            const features = e.features;
            if (!features?.length) return;

            this.canvas.style.cursor = 'pointer';
            
            const feature = features[0];
            const featureId = feature.id;
            
            // Update hover state
            if (featureId !== undefined) {
                if (this.lastHoveredFeatureId !== null && 
                    this.lastHoveredFeatureId !== featureId) {
                    this.map.setFeatureState(
                        { source: SOURCE_ID, id: this.lastHoveredFeatureId },
                        { hover: false }
                    );
                }
                this.map.setFeatureState(
                    { source: SOURCE_ID, id: featureId },
                    { hover: true }
                );
                this.lastHoveredFeatureId = featureId;
            }

            // Trigger callback
            const code = feature.properties?.[this.currentCodeProp];
            const name = feature.properties?.[this.currentCodeProp.replace('CD', 'NM')];
            if (code && this.currentData) {
                this.callbacks.onAreaHover?.({
                    type: this.currentBoundaryType,
                    code,
                    name,
                    data: this.currentData[code] ?? null
                });
            }
        };

        this.mouseLeaveHandler = () => {
            if (this.lastHoveredFeatureId !== null) {
                this.map.setFeatureState(
                    { source: SOURCE_ID, id: this.lastHoveredFeatureId },
                    { hover: false }
                );
                this.lastHoveredFeatureId = null;
            }
            this.canvas.style.cursor = '';
            this.callbacks.onAreaHover?.(null);
        };
    }

    private removeHandlers(): void {
        if (this.mouseMoveHandler) {
            this.map.off('mousemove', FILL_LAYER_ID, this.mouseMoveHandler);
        }
        if (this.mouseLeaveHandler) {
            this.map.off('mouseleave', FILL_LAYER_ID, this.mouseLeaveHandler);
        }
    }

    destroy(): void {
        this.removeHandlers();
        if (this.lastHoveredFeatureId !== null) {
            try {
                this.map.setFeatureState(
                    { source: SOURCE_ID, id: this.lastHoveredFeatureId },
                    { hover: false }
                );
            } catch {}
            this.lastHoveredFeatureId = null;
        }
        this.mouseMoveHandler = null;
        this.mouseLeaveHandler = null;
        this.currentData = null;
    }
}