import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function MapOptions({ map, onThemeChange = () => {} }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState('viridis');

    const themes = [
        { id: 'viridis', label: 'Viridis', gradient: 'linear-gradient(90deg, #440154, #31688e, #35b779, #fde724)' },
        { id: 'plasma', label: 'Plasma', gradient: 'linear-gradient(90deg, #0d0887, #7e03a8, #cc4778, #f89540, #f0f921)' },
        { id: 'inferno', label: 'Inferno', gradient: 'linear-gradient(90deg, #000004, #420a68, #932667, #fca236, #fcfdbf)' },
        { id: 'magma', label: 'Magma', gradient: 'linear-gradient(90deg, #000004, #3b0f70, #8c2981, #fcfdbf)' },
    ];

    const handleZoomIn = () => {
        if (map) map.zoomTo(map.getZoom() + 1);
    };

    const handleZoomOut = () => {
        if (map) map.zoomTo(map.getZoom() - 1);
    };

    const handleThemeChange = (themeId) => {
        setSelectedTheme(themeId);
        setIsOpen(false);
        onThemeChange(themeId);
    };

    return (
        <div className="bg-[rgba(255,255,255,0.5)] text-sm rounded-md backdrop-blur-md shadow-lg border border-white/30">
            <div className="p-2.5 relative">
                <h2 className="font-semibold mb-2">Map Options</h2>
                <div className="flex items-end justify-between gap-2 min-h-26">
                    <div className="absolute flex flex-col top-3 right-3 border border-white/20 rounded-sm overflow-hidden bg-white/10 backdrop-blur-md shadow-sm">
                        <button 
                            onClick={handleZoomIn}
                            className="px-2 py-1 text-sm hover:bg-white/20 transition-all duration-200 text-gray-500 font-semibold leading-none border-b border-gray-200/30 cursor-pointer"
                        >
                            +
                        </button>
                        <button 
                            onClick={handleZoomOut}
                            className="px-2 py-1 text-sm hover:bg-white/20 transition-all duration-200 text-gray-500 font-semibold leading-none cursor-pointer"
                        >
                            −
                        </button>
                    </div>

                    <div className="relative">
                        <button 
                            onClick={() => setIsOpen(!isOpen)}
                            className="border border-white/20 rounded-sm px-2 py-1.5 text-xs bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-200 shadow-sm text-gray-500 font-medium cursor-pointer flex items-center gap-1.5"
                        >
                            <div 
                                className="w-3 h-3 rounded-sm"
                                style={{ background: themes.find(t => t.id === selectedTheme)?.gradient }}
                            />
                            Theme
                            <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isOpen && (
                            <div className="absolute top-full mt-1 right-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-sm shadow-lg overflow-hidden z-10">
                                {themes.map((theme) => (
                                    <button
                                        key={theme.id}
                                        onClick={() => handleThemeChange(theme.id)}
                                        className="w-full px-2.5 py-1.5 text-xs text-left hover:bg-white/20 transition-colors duration-150 border-b border-white/10 last:border-b-0 flex items-center gap-2"
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

                    <button className="border border-white/20 rounded-sm px-2 py-1 text-xs bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-200 shadow-sm text-gray-500 font-medium cursor-pointer">
                        Export
                    </button>
                </div>
            </div>
        </div>
    )
}