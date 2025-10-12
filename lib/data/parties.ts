// lib/data/parties.ts
import { Party } from '@/lib/types/index';

export const PARTY_INFO: Party[] = [
    { key: 'LAB', name: 'Labour', color: '#DC241f' },
    { key: 'CON', name: 'Conservative', color: '#0087DC' },
    { key: 'LD', name: 'Liberal Democrat', color: '#FAA61A' },
    { key: 'GREEN', name: 'Green', color: '#6AB023' },
    { key: 'REF', name: 'Reform', color: '#12B6CF' },
    { key: 'IND', name: 'Independent', color: '#CCCCCC' }
];

export const PARTY_COLORS: Record<string, string> = {
    'LAB': '#DC241f',
    'CON': '#0087DC',
    'LD': '#FAA61A',
    'GREEN': '#6AB023',
    'REF': '#12B6CF',
    'IND': '#CCCCCC',
    'OTHER': '#999999',
    'NONE': '#EEEEEE'
};