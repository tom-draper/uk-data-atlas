'use client';
import { LocationBounds, PopulationDataset } from '@lib/types';
import TitlePane from './TitlePane';
import LocationPane from './LocationPanel';
import MapOptions from './MapOptions';
import { memo } from 'react';
import { MapOptions as MapOptionsType } from '@/lib/types/mapOptions';

interface ControlPanelProps {
    selectedLocation: string | null;
    onLocationClick: (location: string, bounds: LocationBounds) => void;
    populationDataset: PopulationDataset
    onZoomIn: () => void;
    onZoomOut: () => void;
	handleMapOptionsChange: (type: keyof MapOptionsType, options: Partial<MapOptionsType[typeof type]>) => void;
}

export default memo(function ControlPanel({ 
    selectedLocation, 
    onLocationClick, 
    populationDataset, 
    onZoomIn, 
    onZoomOut,
    handleMapOptionsChange
}: ControlPanelProps) {
    return (
        <div className="flex flex-col h-full max-h-screen">
            <div className="pointer-events-auto p-2.5 pb-0 w-[320px] shrink-0">
                <TitlePane />
            </div>

            <div className="pointer-events-auto p-2.5 pb-0 w-[320px] flex-1 min-h-0">
                <LocationPane selectedLocation={selectedLocation} onLocationClick={onLocationClick} populationDataset={populationDataset} />
            </div>

            <div className="pointer-events-auto p-2.5 w-[320px] shrink-0">
                <MapOptions onZoomIn={onZoomIn} onZoomOut={onZoomOut} handleMapOptionsChange={handleMapOptionsChange} />
            </div>
        </div>
    );
});
