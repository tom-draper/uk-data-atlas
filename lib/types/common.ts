// lib/types/common.ts

export type PartyCode = keyof typeof import("../data/election/parties").PARTIES;
export type EthnicityCode = keyof typeof import("../helpers/colorScale").ETHNICITY_COLORS;

export interface PartyVotes {
	LAB?: number;
	CON?: number;
	LD?: number;
	GREEN?: number;
	REF?: number;
	BRX?: number;
	UKIP?: number;
	SNP?: number;
	DUP?: number;
	PC?: number;
	SF?: number;
	APNI?: number;
	SDLP?: number;
	IND?: number;
	RUK?: number;
	UUP?: number;
	OTHER?: number;
}

export interface Party {
	key: PartyCode;
	name: string;
}

export type AgeData = Record<string, number>;

export interface ColorRange {
	min: number;
	max: number;
}
