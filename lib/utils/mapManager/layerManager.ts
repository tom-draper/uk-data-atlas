// lib/utils/mapManager/layerManager.ts
import { BoundaryGeojson, Party } from '@lib/types';
import { LocalElectionOptions, GeneralElectionOptions } from '@lib/types/mapOptions';
import { PARTIES } from '@/lib/data/election/parties';
import { getPartyPercentageColorExpression } from '../colorScale';

const SOURCE_ID = 'location-wards';
const FILL_LAYER_ID = 'wards-fill';
const LINE_LAYER_ID = 'wards-line';

export class LayerManager {
    constructor(private map: mapboxgl.Map | maplibregl.Map) {}

    updateElectionLayers(locationData: BoundaryGeojson, partyInfo: Party[]): void {
        this.removeExistingLayers();
        this.addSource(locationData);

        const colorExpression: any[] = ['match', ['get', 'winningParty']];
        for (const party of partyInfo) {
            colorExpression.push(party.key, PARTIES[party.key].color);
        }
        colorExpression.push('#cccccc');

        this.map.addLayer({
            id: FILL_LAYER_ID,
            type: 'fill',
            source: SOURCE_ID,
            paint: {
                'fill-color': colorExpression,
                'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.35, 0.6]
            }
        });

        this.addBorderLayer();
    }

    updatePartyPercentageLayers(
        locationData: BoundaryGeojson,
        options: LocalElectionOptions | GeneralElectionOptions
    ): void {
        this.removeExistingLayers();
        this.addSource(locationData);

        const baseColor = PARTIES[options.selectedParty]?.color || '#999999';
        const fillColorExpression = getPartyPercentageColorExpression(baseColor, options);

        this.map.addLayer({
            id: FILL_LAYER_ID,
            type: 'fill',
            source: SOURCE_ID,
            paint: {
                'fill-color': fillColorExpression,
                'fill-opacity': 0.7,
            }
        });

        this.addBorderLayer();
    }

    updateColoredLayers(locationData: BoundaryGeojson): void {
        this.removeExistingLayers();
        this.addSource(locationData);

        this.map.addLayer({
            id: FILL_LAYER_ID,
            type: 'fill',
            source: SOURCE_ID,
            paint: {
                'fill-color': ['get', 'color'],
                'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.35, 0.6]
            }
        });

        this.addBorderLayer();
    }

    private addBorderLayer(): void {
        this.map.addLayer({
            id: LINE_LAYER_ID,
            type: 'line',
            source: SOURCE_ID,
            paint: {
                'line-color': '#000',
                'line-width': 1,
                'line-opacity': 0.05
            }
        });
    }

    private removeExistingLayers(): void {
        const source = this.map.getSource(SOURCE_ID);
        if (source) {
            if (this.map.getLayer(FILL_LAYER_ID)) this.map.removeLayer(FILL_LAYER_ID);
            if (this.map.getLayer(LINE_LAYER_ID)) this.map.removeLayer(LINE_LAYER_ID);
            this.map.removeSource(SOURCE_ID);
        }
    }

    private addSource(locationData: BoundaryGeojson): void {
        this.map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: locationData
        });
    }
}