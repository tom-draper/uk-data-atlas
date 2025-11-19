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

export const PARTIES = {
    'LAB': { color: '#E91D0E', name: 'Labour' },
    'CON': { color: '#0575C9', name: 'Conservative' },
    'LD': { color: '#FF9A02', name: 'Liberal Democrat' },
    'GREEN': { color: '#5FB25F', name: 'Green' },
    'REF': { color: '#0AD1E0', name: 'Reform' },
    'RUK': { color: '#0AD1E0', name: 'Reform' },
    'SNP': { color: '#ffd02c', name: 'Scottish National Party' },
    'PC': { color: '#4eecaf', name: 'Plaid Cymru' },
    'SF': { color: '#24aa83', name: 'Sinn Fein' },
    'DUP': { color: '#c9235f', name: 'Democratic Unionist Party' },
    'SDLP': { color: '#577557', name: 'Social Democratic & Labour Party' },
    'APNI': { color: '#d6b429', name: 'Alliance Party' },
    'BRX': { color: '#11b0c9', name: 'Brexit Party' },
    'UKIP': { color: '#6a2f73', name: 'UKIP' },
    'IND': { color: '#FC86C2', name: 'Independent' },
    'UUP': { color: '#FC86C2', name: 'UUP' },
    'OTHER': { color: '#999999', name: 'Other' }
} as const;
