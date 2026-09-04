// lib/types/elections.ts
import { ConstituencyYear, WardYear } from "../data/boundaries/boundaries";
import { PartyVotes, Party } from "./common";

export interface LocalElectionWardData {
	ladCode: string;
	ladName: string;
	totalVotes: number;
	turnoutPercent: number;
	wardName: string;
	wardCode: string;
	electorate: number;
	partyVotes: PartyVotes;
}

export interface GeneralElectionConstituencyData {
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

export interface LocalAuthorityData {
	ladCode: string;
	ladName: string;
	regionName: string;
	countryName: string;
}

export type ElectionData =
	| LocalElectionWardData
	| GeneralElectionConstituencyData
	| LocalAuthorityData;

export const LOCAL_ELECTION_YEARS = [
	2025, 2024, 2023, 2022, 2021, 2019, 2018, 2017, 2016,
] as const;
export const GENERAL_ELECTION_YEARS = [2024, 2019, 2017, 2015] as const;

export type LocalElectionYear = (typeof LOCAL_ELECTION_YEARS)[number];
export type GeneralElectionYear = (typeof GENERAL_ELECTION_YEARS)[number];

interface BaseElectionDataset<D extends ElectionData> {
	id: string;
	year: number;
	partyInfo: Party[];
}

export interface LocalElectionDataset extends BaseElectionDataset<LocalElectionWardData> {
	type: "localElection";
	year: LocalElectionYear;
	boundaryType: "ward";
	boundaryYear: WardYear;
	results: Record<string, string>;
	data: Record<string, LocalElectionWardData>;
}

export interface GeneralElectionDataset extends BaseElectionDataset<GeneralElectionConstituencyData> {
	type: "generalElection";
	year: GeneralElectionYear;
	boundaryType: "constituency";
	boundaryYear: ConstituencyYear;
	results: Record<string, string>;
	data: Record<string, GeneralElectionConstituencyData>;
}

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

export interface AggregatedLocalElectionData extends WardStats {}

export interface AggregatedGeneralElectionData extends ConstituencyStats {}

export interface ProcessedPartyData {
	key: string;
	name: string;
	color: string;
	votes: number;
	percentage: number;
}
