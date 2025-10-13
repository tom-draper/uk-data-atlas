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
        <div className="flex flex-col">
            <div className="pointer-events-auto p-[10px] pb-0 w-[320px]">
                <div className="bg-[rgba(255,255,255,0.6)] text-sm rounded-md backdrop-blur-md shadow-lg overflow-y-auto">
                    <div className="p-[10px] border-b border-gray-200 flex align-center">

                        <img src="/union-jack.png" alt="UK Data Atlas Logo" className="h-[24px] opacity-100 rounded grayscale-0 mr-3 content-center mt-[2px] transform scale-x-[-1] hover:grayscale-0 transition-all duration-1000 cursor-pointer" />
                        <h1 className="font-semibold text-lg">UK Data Atlas</h1>
                    </div>
                </div>
            </div>

            <div className="pointer-events-auto p-[10px] pb-0 w-[320px] flex-grow">
                <div className="bg-[rgba(255,255,255,0.6)] h-[100%] text-sm rounded-md backdrop-blur-md shadow-lg overflow-y-auto">
                    <div className="p-[10px] border-b border-gray-200 h-[100%]">
                        <h2 className="font-semibold mb-2">Locations</h2>
                        <div className="space-y-0">
                            {LOCATIONS.map((location) => (
                                <button
                                    key={location.name}
                                    onClick={() => onLocationClick(location)}
                                    className={`w-full text-left px-0 py-[2px] rounded transition-colors text-xs cursor-pointer ${
                                        selectedLocation === location.name
                                            ? 'text-black font-bold'
                                            : 'hover:font-bold text-[gray]'
                                    }`}
                                >
                                    {location.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="pointer-events-auto p-[10px] w-[320px]">
                <div className="bg-[rgba(255,255,255,0.6)] text-sm rounded-md backdrop-blur-md shadow-lg overflow-y-auto">
                    <div className="p-[10px] border-b border-gray-200">
                        <h2 className="font-semibold mb-2">Map Options</h2>
                        <div className="h-52">

                        </div>
                    </div>
                </div>
            </div>


        </div>

    );
};