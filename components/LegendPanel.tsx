// components/LegendPanel.tsx
'use client';
import { PARTY_INFO } from '@/lib/data/parties';

export const LegendPanel = () => {
    return (
        <div className="pointer-events-none place-content-end py-[10px]">
            <div className="bg-[rgba(255,255,255,0.8)] pointer-events-auto p-[10px] rounded-md backdrop-blur-md shadow-lg">
                <h3 className="font-bold text-sm mb-2">Local Elections 2024</h3>
                <div className="space-y-1 text-xs">
                    {PARTY_INFO.map(party => (
                        <div key={party.key} className="flex items-center gap-2">
                            <div className="w-3 h-3" style={{ backgroundColor: party.color }}></div>
                            <span>{party.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};