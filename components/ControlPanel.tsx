'use client';
import { LocationBounds, PopulationWardData } from '@lib/types';
import TitlePane from './TitlePane';
import LocationPane from './LocationPane';
import MapOptions from './MapOptions';
import { memo } from 'react';

interface ControlPanelProps {
    selectedLocation: string | null;
    onLocationClick: (location: LocationBounds) => void;
    population: PopulationWardData;
}

export default memo(function ControlPanel({ selectedLocation, onLocationClick, population }: ControlPanelProps) {
    return (
        <div className="flex flex-col h-full max-h-screen">
            {/* Title */}
            <div className="pointer-events-auto p-2.5 pb-0 w-[320px] shrink-0">
                <TitlePane />
            </div>

            {/* Locations list */}
            <div className="pointer-events-auto p-2.5 pb-0 w-[320px] flex-1 min-h-0">
                <LocationPane selectedLocation={selectedLocation} onLocationClick={onLocationClick} population={population} />
            </div>

            {/* Map Options */}
            <div className="pointer-events-auto p-2.5 w-[320px] shrink-0">
                <MapOptions />
            </div>
        </div>
    );
});
