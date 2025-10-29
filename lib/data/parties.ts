// lib/data/parties.ts
import { Party } from '@lib/types/index';

export const PARTY_INFO: Party[] = [
    { key: 'LAB', name: 'Labour' },
    { key: 'CON', name: 'Conservative' },
    { key: 'LD', name: 'Liberal Democrat' },
    { key: 'GREEN', name: 'Green' },
    { key: 'REF', name: 'Reform' },
    { key: 'IND', name: 'Independent' }
];

export const PARTY_COLORS: Record<string, string> = {
    'LAB': '#E91D0E',
    'CON': '#0575C9',
    'LD': '#FF9A02',
    'GREEN': '#5FB25F',
    'REF': '#0AD1E0',
    'IND': '#FC86C2',
    'OTHER': '#999999',
    'NONE': '#EEEEEE'
};