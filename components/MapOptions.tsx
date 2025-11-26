import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { themes } from '@/lib/utils/colorScale';
import { ColorTheme, MapOptions as MapOptionsType } from '@/lib/types/mapOptions';

interface MapOptionsProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
	handleMapOptionsChange: (type: keyof MapOptionsType, options: Partial<MapOptionsType[typeof type]>) => void;
}

export default function MapOptions({ onZoomIn, onZoomOut, handleMapOptionsChange }: MapOptionsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState('viridis');
    const containerRef = useRef<HTMLDivElement>(null);

    const handleThemeChange = (themeId: ColorTheme) => {
        setSelectedTheme(themeId);
        setIsOpen(false);
        handleMapOptionsChange('general', { theme: themeId });
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [isOpen]);

    return (
        <div className="bg-[rgba(255,255,255,0.5)] text-sm rounded-md backdrop-blur-md shadow-lg border border-white/30">
            <div className="p-2.5 relative">
                <h2 className="font-semibold mb-2">Map Options</h2>
                <div className="flex items-end justify-between gap-2 min-h-26">
                    <div className="absolute flex flex-col top-2.5 right-2.5 border border-white/20 rounded-sm overflow-hidden bg-white/10 backdrop-blur-md shadow-sm">
                        <button
                            onClick={onZoomIn}
                            className="px-2 py-1 text-sm hover:bg-white/20 transition-all duration-200 text-gray-500 font-semibold leading-none border-b border-gray-200/30 cursor-pointer"
                        >
                            +
                        </button>
                        <button
                            onClick={onZoomOut}
                            className="px-2 py-1 text-sm hover:bg-white/20 transition-all duration-200 text-gray-500 font-semibold leading-none cursor-pointer"
                        >
                            −
                        </button>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="border border-white/20 rounded-sm px-2 py-1.5 text-xs bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-200 shadow-sm text-gray-500 cursor-pointer flex items-center gap-1.5"
                        >
                            <div
                                className="w-3 h-3 rounded-sm"
                                style={{ background: themes.find(t => t.id === selectedTheme)?.gradient }}
                            />
                            Heatmap
                            <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
                        </button>

                        {isOpen && (
                            <div ref={containerRef} className="absolute bottom-full mb-2 left-0 bg-[#f9f9fa]/90 backdrop-blur-xl border border-white/20 rounded-sm shadow-lg z-10">
                                {themes.map((theme) => (
                                    <button
                                        key={theme.id}
                                        onClick={() => handleThemeChange(theme.id)}
                                        className="w-full px-2.5 py-1.5 text-xs text-left hover:bg-white/20 transition-colors duration-150 border-b border-white/10 last:border-b-0 flex items-center gap-2 cursor-pointer"
                                    >
                                        <div
                                            className="w-4 h-4 rounded-sm shrink-0"
                                            style={{ background: theme.gradient }}
                                        />
                                        <span className="text-gray-600 font-medium">{theme.label}</span>
                                        {selectedTheme === theme.id && (
                                            <span className="ml-auto text-gray-400">✓</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button className="absolute right-2.5 bottom-2.5 border border-white/20 rounded-sm px-2 py-1 text-xs bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-200 shadow-sm text-gray-500">
                        Export
                    </button>
                </div>
            </div>
        </div>
    )
}