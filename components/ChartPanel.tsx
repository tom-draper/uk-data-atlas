// components/ChartPanel.tsx
'use client';
import { ChartData } from '@/lib/types';
import { PARTY_INFO } from '@/lib/data/parties';

interface ChartPanelProps {
    title: string;
    wardCode: string;
    chartData: ChartData;
}

export const ChartPanel = ({ title, wardCode, chartData }: ChartPanelProps) => {
    const maxVotes = Math.max(
        chartData.LAB,
        chartData.CON,
        chartData.LD,
        chartData.GREEN,
        chartData.REF,
        chartData.IND
    );

    return (
        <div className="pointer-events-auto p-[10px] flex flex-col h-full w-[250px]">
            <div className="bg-[rgba(255,255,255,0.8)] rounded-md backdrop-blur-md shadow-lg h-[100%] p-[10px] flex flex-col">
                <div className="min-h-[60px]">
                    <h2 className="font-semibold text-sm">{title}</h2>
                    <div className="text-gray-500 text-xs">{wardCode}</div>
                </div>
                <div className="space-y-2">
                    {PARTY_INFO.map(party => (
                        <div key={party.key}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-medium">{party.name}</span>
                                <span className="text-xs font-bold">
                                    {(chartData[party.key] as number).toLocaleString()}
                                </span>
                            </div>
                            <div className="h-6 bg-gray-200 rounded overflow-hidden">
                                <div
                                    style={{
                                        height: '100%',
                                        width: maxVotes > 0 ? ((chartData[party.key] as number) / maxVotes * 100) : 0,
                                        backgroundColor: party.color,
                                        transition: 'width 0.3s ease'
                                    }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};