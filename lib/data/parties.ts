// lib/data/parties.ts
import { Party } from '@lib/types/index';

export const PARTY_INFO: Party[] = [
    { key: 'LAB', name: 'Labour', color: '#e4003b' },
    { key: 'CON', name: 'Conservative', color: '#29a6db' },
    { key: 'LD', name: 'Liberal Democrat', color: '#ff6400' },
    { key: 'GREEN', name: 'Green', color: '#01a357' },
    { key: 'REF', name: 'Reform', color: '#1db2c9' },
    { key: 'IND', name: 'Independent', color: '#CCCCCC' }
];

export const PARTY_COLORS: Record<string, string> = {
    'LAB': '#e4003b',
    'CON': '#29a6db',
    'LD': '#ff6400',
    'GREEN': '#01a357',
    'REF': '#1db2c9',
    'IND': '#CCCCCC',
    'OTHER': '#999999',
    'NONE': '#EEEEEE'
};