// lib/data/parties.ts
import { Party } from '@lib/types/index';

export const PARTY_INFO: Party[] = [
    { key: 'LAB', name: 'Labour' },
    { key: 'CON', name: 'Conservative' },
    { key: 'LD', name: 'Liberal Democrat' },
    { key: 'GREEN', name: 'Green' },
    { key: 'REF', name: 'Reform' },
    { key: 'SNP', name: 'Scottish National Party' },
    { key: 'PC', name: 'Plaid Cymru' },
    { key: 'SF', name: 'Sinn Fein' },
    { key: 'DUP', name: 'Democratic Unionist Party' },
    { key: 'SDLP', name: 'Social Democratic & Labour Party' },
    { key: 'APNI', name: 'Alliance Party' },
    { key: 'IND', name: 'Independent' }
];

export const PARTY_COLORS: Record<string, string> = {
    'LAB': '#E91D0E',
    'CON': '#0575C9',
    'LD': '#FF9A02',
    'GREEN': '#5FB25F',
    'REF': '#0AD1E0',
    'IND': '#FC86C2',
    'SNP': '#ffd02c',
    'PC': '#4eecaf',
    'SF': '#24aa83',
    'DUP': '#c9235f',
    'SDLP': '#577557',
    'APNI': '#d6b429',
    'OTHER': '#999999',
    'NONE': '#EEEEEE'
};