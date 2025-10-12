// components/LocationPanel.tsx
'use client';
import { LocationBounds } from '@/lib/types';
import { LOCATIONS } from '@/lib/data/locations';

interface LocationPanelProps {
    selectedLocation: string | null;
    onLocationClick: (location: LocationBounds) => void;
}

export const LocationPanel = ({ selectedLocation, onLocationClick }: LocationPanelProps) => {
    return (
        <div className="pointer-events-auto p-[10px] w-[250px]">
            <div className="bg-[rgba(255,255,255,0.8)] text-sm rounded-md backdrop-blur-md shadow-lg max-h-[90vh] overflow-y-auto">
                <div className="p-[10px] border-b border-gray-200">
                    <h2 className="font-semibold mb-2">Locations</h2>
                    <div className="space-y-0">
                        {LOCATIONS.map((location) => (
                            <button
                                key={location.name}
                                onClick={() => onLocationClick(location)}
                                className={`w-full text-left px-0 py-1 rounded transition-colors text-xs cursor-pointer ${
                                    selectedLocation === location.name
                                        ? 'text-black font-bold'
                                        : 'hover:font-bold'
                                }`}
                            >
                                {location.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};