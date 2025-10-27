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
    'LAB': '#e4003b',
    'CON': '#29a6db',
    'LD': '#ff6400',
    'GREEN': '#01a357',
    'REF': '#1db2c9',
    'IND': '#CCCCCC',
    'OTHER': '#999999',
    'NONE': '#EEEEEE'
};