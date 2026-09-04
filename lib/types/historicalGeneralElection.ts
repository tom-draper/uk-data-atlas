// lib/types/historicalGeneralElection.ts

/**
 * The source aggregates every party into five broad groups rather than the
 * full per-party breakdown newer general election datasets carry.
 */
export type HistoricalPartyGroup = "CON" | "LIB" | "LAB" | "NAT" | "OTHER";

export interface HistoricalElectionConstituencyResult {
	constituencyId: string;
	constituencyName: string;
	region: string;
	seats: number;
	electorate: number | null;
	votes: Partial<Record<HistoricalPartyGroup, number>>;
	voteShare: Partial<Record<HistoricalPartyGroup, number>>;
	totalVotes: number | null;
	turnoutPercent: number | null;
}

export interface HistoricalGeneralElectionDataset {
	id: string;
	type: "historicalGeneralElection";
	/** The source's own label, e.g. "1974F" for February 1974. */
	election: string;
	/** Calendar year; 1974F and 1974O both resolve to 1974. */
	year: number;
	boundaryType: "constituency";
	/**
	 * No boundary geometry exists yet for this era: BOUNDARY_CATALOG only
	 * covers 2010 onward. This is provisionally the election's calendar year,
	 * kept so a matching historical boundary file can be wired in later; it is
	 * not yet a usable ConstituencyYear vintage.
	 */
	boundaryYear: number;
	/** The Commons Library's boundary review label, e.g. "1918-1935". */
	boundarySet: string;
	/** Keyed by the source's own constituency_id (not an ONS/GSS code). */
	data: Record<string, HistoricalElectionConstituencyResult>;
}
