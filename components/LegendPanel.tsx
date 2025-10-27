// components/LegendPanel.tsx
'use client';
import { PARTY_COLORS, PARTY_INFO } from '@lib/data/parties';
import { memo } from 'react';

export default memo(function LegendPanel() {
    return (
        <div className="pointer-events-none py-2.5">
            <div className="bg-[rgba(255,255,255,0.5)] pointer-events-auto p-2.5 rounded-md backdrop-blur-md shadow-lg border border-white/30">
                <div className="space-y-1 text-xs">
                    {PARTY_INFO.map(party => (
                        <div key={party.key} className="flex items-center gap-2">
                            <div className="w-3 h-3" style={{ backgroundColor: PARTY_COLORS[party.key] }}></div>
                            <span>{party.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});