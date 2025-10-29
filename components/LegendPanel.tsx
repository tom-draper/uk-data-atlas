// components/LegendPanel.tsx
'use client';
import { memo } from 'react';

interface LegendPanelProps {
    isPopulationMode?: boolean;
}

const PARTY_LEGEND = [
    { color: '#DC241f', label: 'Labour' },
    { color: '#0087DC', label: 'Conservative' },
    { color: '#FAA61A', label: 'Liberal Democrat' },
    { color: '#6AB023', label: 'Green' },
    { color: '#12B6CF', label: 'Reform UK' },
    { color: '#DDDDDD', label: 'Independent' },
];

export default memo(function LegendPanel({ isPopulationMode = false }: LegendPanelProps) {
    return (
        <div className="pointer-events-none p-2.5 flex flex-col h-full">
            <div className="bg-[rgba(255,255,255,0.5)] pointer-events-auto rounded-md backdrop-blur-md shadow-lg p-2.5 border border-white/30">
                {isPopulationMode ? (
                    <div className="space-y-2">
                        <div className="h-40 w-6 rounded" style={{
                            background: 'linear-gradient(to top, rgb(253,231,37), rgb(94,201,98), rgb(33,145,140), rgb(59,82,139), rgb(68,1,84))'
                        }} />
                        <div className="flex flex-col justify-between h-40 text-[10px] text-gray-600 -mt-40 ml-8">
                            <span>55</span>
                            <span>47</span>
                            <span>40</span>
                            <span>32</span>
                            <span>25</span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {PARTY_LEGEND.map((item) => (
                            <div key={item.label} className="flex items-center gap-2">
                                <div
                                    className="w-4 h-4 rounded-sm shrink-0"
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className="text-xs text-gray-700">{item.label}</span>
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
});