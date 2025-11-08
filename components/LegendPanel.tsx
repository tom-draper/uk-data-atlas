// components/LegendPanel.tsx
'use client';
import { PARTY_COLORS, PARTY_INFO } from '@/lib/data/parties';
import { memo } from 'react';

interface LegendPanelProps {
    activeDatasetId: string;
}

export default memo(function LegendPanel({ activeDatasetId }: LegendPanelProps) {
    return (
        <div className="pointer-events-none p-2.5 pr-0 flex flex-col h-full">
            <div className="bg-[rgba(255,255,255,0.5)] pointer-events-auto rounded-md backdrop-blur-md shadow-lg border border-white/30">
                <div className="bg-white/20 p-2.5 overflow-hidden">
                    {activeDatasetId === 'population' ? (
                        <div>
                            <div className="h-40 w-6 rounded" style={{
                                background: 'linear-gradient(to bottom, rgb(253,231,37), rgb(94,201,98), rgb(33,145,140), rgb(59,82,139), rgb(68,1,84))'
                            }} />
                            <div className="flex flex-col justify-between h-40 text-[10px] text-gray-400/80 -mt-40 ml-8">
                                <span>55</span>
                                <span>47</span>
                                <span>40</span>
                                <span>32</span>
                                <span>25</span>
                            </div>
                        </div>
                    ) : activeDatasetId === 'density' ? (
                        <div>
                            <div className="h-40 w-6 rounded" style={{
                                background: 'linear-gradient(to bottom, rgb(253,231,37), rgb(94,201,98), rgb(33,145,140), rgb(59,82,139), rgb(68,1,84))'
                            }} />
                            <div className="flex flex-col justify-between h-40 text-[10px] text-gray-400/80 -mt-40 ml-8">
                                <span>10000</span>
                                <span>5000</span>
                                <span>2000</span>
                                <span>1000</span>
                                <span>500</span>
                            </div>
                        </div>
                    ) : activeDatasetId === 'gender' ? (
                        <div>
                            <div className="h-40 w-6 rounded" style={{
                                background: 'linear-gradient(to top, rgba(255,105,180,0.8), rgba(240,240,240,0.8), rgba(70,130,180,0.8))'
                            }} />
                            <div className="flex flex-col justify-between h-40 text-[10px] text-gray-400/80 -mt-40 ml-8">
                                <span>M</span>
                                <span>F</span>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {PARTY_INFO.map((item) => (
                                <div key={item.key} className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-xs shrink-0"
                                        style={{ backgroundColor: PARTY_COLORS[item.key] }}
                                    />
                                    <span className="text-xs text-gray-700">{item.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});