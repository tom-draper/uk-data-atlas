// lib/types/elections.ts
// Election-related types for both local and general elections

import { ConstituencyYear, WardYear } from "../data/boundaries/boundaries";
import { PartyVotes, Party } from "./common";

export interface LocalElectionWardData {
    localAuthorityCode: string;
    localAuthorityName: string;
    totalVotes: number;
    turnoutPercent: number;
    wardName: string;
    wardCode: string;
    electorate: number;
    partyVotes: PartyVotes;
}

export interface ConstituencyData {
    constituencyName: string;
    onsId: string;
    regionName: string;
    countryName: string;
    constituencyType: string;
    memberFirstName: string;
    memberSurname: string;
    memberGender: string;
    result: string;
    firstParty: string;
    secondParty: string;
    electorate: number;
    validVotes: number;
    invalidVotes: number;
    majority: number;
    partyVotes: PartyVotes;
    turnoutPercent: number;
}

export type ElectionData = LocalElectionWardData | ConstituencyData;

// Base election dataset with common properties
interface BaseElectionDataset<D extends ElectionData> {
    id: string;
    year: number;
    partyInfo: Party[];
}

export interface LocalElectionDataset extends BaseElectionDataset<LocalElectionWardData> {
    type: 'localElection';
    boundaryType: 'ward';
    boundaryYear: WardYear;
    wardResults: Record<string, string>;
    wardData: Record<string, LocalElectionWardData>;
}

export interface GeneralElectionDataset extends BaseElectionDataset<ConstituencyData> {
    type: 'generalElection';
    boundaryType: 'constituency';
    boundaryYear: ConstituencyYear;
    constituencyResults: Record<string, string>;
    constituencyData: Record<string, ConstituencyData>;
}

export const LOCAL_ELECTION_YEARS = [2024, 2023, 2022, 2021] as const;
export const GENERAL_ELECTION_YEARS = [2024, 2019, 2017, 2015] as const;

// Aggregated election data
export interface WardStats {
    partyVotes: PartyVotes;
    electorate: number;
    totalVotes: number;
}

export interface ConstituencyStats {
    totalSeats: number;
    partySeats: Record<string, number>;
    totalVotes: number;
    partyVotes: PartyVotes;
    electorate: number;
    validVotes: number;
    invalidVotes: number;
}

export interface AggregatedLocalElectionData extends Record<number, WardStats> {}
export interface AggregatedGeneralElectionData extends Record<number, ConstituencyStats> {}
