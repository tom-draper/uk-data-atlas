import type { MapMouseEvent } from 'mapbox-gl';
import type { MapMouseEvent as MapLibreMouseEvent } from 'maplibre-gl';
import { MapManagerCallbacks, MapMode } from './mapManager';

const SOURCE_ID = 'location-wards';
const FILL_LAYER_ID = 'wards-fill';

// Union type for events that works with both libraries
type MapMouseEventType = MapMouseEvent | MapLibreMouseEvent;

export class EventHandler {
    private lastHoveredFeatureId: string | number | null = null;
    private mouseMoveHandler: ((e: MapMouseEventType & { features?: any[] }) => void) | null = null;
    private mouseLeaveHandler: (() => void) | null = null;
    
    // Pre-bound methods for maximum performance
    private boundUpdateHover: ((code: string, name: string, data: any) => void) | null = null;
    private boundClearHover: (() => void) | null = null;
    
    // Cache lookups
    private currentData: Record<string, any> | null = null;
    private currentCodeProp: string = '';
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
        
        this.removeHandlers();
        this.createHandlers(mode);
        
        this.map.on('mousemove', FILL_LAYER_ID, this.mouseMoveHandler!);
        this.map.on('mouseleave', FILL_LAYER_ID, this.mouseLeaveHandler!);
    }

    private createHandlers(mode: MapMode): void {
        // Pre-bind hover callbacks based on mode for fastest dispatch
        switch (mode) {
            case 'generalElection':
                this.boundUpdateHover = (code: string, name: string, data: any) => {
                    this.callbacks.onAreaHover?.({
                        type: 'constituency',
                        code,
                        name,
                        data: data ?? null
                    });
                };
                this.boundClearHover = () => {
                    this.callbacks.onAreaHover?.(null);
                };
                break;
                
            case 'crime':
            case 'income':
                this.boundUpdateHover = (code: string, name: string, data: any) => {
                    this.callbacks.onAreaHover?.({
                        type: 'localAuthority',
                        code,
                        name,
                        data: data ?? null
                    });
                };
                this.boundClearHover = () => {
                    this.callbacks.onAreaHover?.(null);
                };
                break;
                
            case 'population':
                this.boundUpdateHover = (code: string, name: string, data: any) => {
                    this.callbacks.onAreaHover?.({
                        type: 'ward',
                        code,
                        name,
                        data: this.transformPopulationData(code, data)
                    });
                };
                this.boundClearHover = () => {
                    this.callbacks.onAreaHover?.(null);
                };
                break;
                
            default: // localElection, housePrice
                this.boundUpdateHover = (code: string, name: string, data: any) => {
                    this.callbacks.onAreaHover?.({
                        type: 'ward',
                        code,
                        name,
                        data: data ?? null
                    });
                };
                this.boundClearHover = () => {
                    this.callbacks.onAreaHover?.(null);
                };
        }

        // Inline mousemove for absolute maximum performance
        this.mouseMoveHandler = (e: MapMouseEventType & { features?: any[] }) => {
            const features = e.features;
            if (!features?.length) return;

            this.canvas.style.cursor = 'pointer';
            
            const feature = features[0];
            const featureId = feature.id;
            
            // Fast hover state update
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

            // Fast data lookup and callback
            const code = feature.properties?.[this.currentCodeProp];
            const name = feature.properties?.[this.currentCodeProp.replace('CD', 'NM')];
            if (code && this.currentData) {
                this.boundUpdateHover!(code, name, this.currentData[code]);
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
            this.boundClearHover!();
        };
    }

    // Only used for population mode - keep separate to avoid overhead in other modes
    private transformPopulationData(wardCode: string, wardPopData: any): any {
        if (!wardPopData) return null;
        
        return {
            wardCode,
            wardName: wardPopData.wardName ?? '',
            localAuthorityCode: wardPopData.laCode ?? '',
            localAuthorityName: wardPopData.laName ?? '',
            LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0
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
        this.boundUpdateHover = null;
        this.boundClearHover = null;
        this.currentData = null;
    }
}