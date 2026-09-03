import { PartyVotes } from "../types/common";
import {
	AggregatedLocalElectionData,
	LocalElectionDataset,
	ProcessedPartyData,
} from "../types/elections";
import type { SelectedArea } from "../types/areas";
import { calculateTurnout, processPartyVotes } from "./generalElection";

export interface ProcessedLocalElectionYearData {
	year: number;
	dataset: LocalElectionDataset | null;
	partyData: ProcessedPartyData[];
	totalVotes: number;
	turnout: number | null;
	hasData: boolean;
}

// Cache LAD vote aggregations — keyed by ladCode, then election year
const MAX_LAD_CACHE_ENTRIES = 50;
const localElectionLadCache = new Map<
	string,
	Map<
		number,
		{ partyVotes: Record<string, number>; electorate: number } | null
	>
>();

export function computeLocalElectionYearData(
	year: number,
	dataset: LocalElectionDataset | undefined,
	aggregatedData: Record<number, AggregatedLocalElectionData> | null,
	selectedArea: SelectedArea | null,
	getCodeForYear:
		| ((
				type: "ward",
				code: string,
				targetYear: number,
		  ) => string | undefined)
		| undefined,
	getWardsForLad: ((ladCode: string, year: number) => string[]) | undefined,
	getWardsForConstituency:
		((constituencyCode: string, wardYear: number) => string[]) | undefined,
	excluded: Set<string> | undefined,
	selectedParty: string | undefined,
): ProcessedLocalElectionYearData {
	if (!dataset) {
		return {
			year,
			dataset: null,
			partyData: [],
			totalVotes: 0,
			turnout: null,
			hasData: false,
		};
	}

	let rawPartyVotes: PartyVotes | null = null;
	let turnout: number | null = null;

	// Handle Ward Selection
	if (selectedArea && selectedArea.type === "ward") {
		const wardCode = selectedArea.code;
		let data = dataset.data[wardCode];

		if (!data && getCodeForYear) {
			const mappedCode = getCodeForYear("ward", wardCode, year);
			if (mappedCode) {
				data = dataset.data[mappedCode];
			}
		}

		if (data) {
			rawPartyVotes = data.partyVotes;
			turnout = data.turnoutPercent;
		}
	} else if (
		selectedArea &&
		selectedArea.type === "localAuthority" &&
		getWardsForLad
	) {
		const ladCode = selectedArea.code;

		// Check cache first
		if (!localElectionLadCache.has(ladCode)) {
			if (localElectionLadCache.size >= MAX_LAD_CACHE_ENTRIES) {
				localElectionLadCache.delete(
					localElectionLadCache.keys().next().value!,
				);
			}
			localElectionLadCache.set(ladCode, new Map());
		}
		const yearCache = localElectionLadCache.get(ladCode)!;

		let cached = yearCache.get(year);
		if (!yearCache.has(year)) {
			const wardCodes = getWardsForLad(ladCode, year);
			const aggregatedVotes: Record<string, number> = {};
			let totalElectorate = 0;

			for (const wardCode of wardCodes) {
				let wardData = dataset.data[wardCode];

				if (!wardData && getCodeForYear) {
					const mappedCode = getCodeForYear("ward", wardCode, year);
					if (mappedCode) {
						wardData = dataset.data[mappedCode];
					}
				}

				if (wardData?.partyVotes) {
					for (const [partyKey, votes] of Object.entries(
						wardData.partyVotes,
					)) {
						aggregatedVotes[partyKey] =
							(aggregatedVotes[partyKey] || 0) + (votes || 0);
					}
					if (wardData.electorate) {
						totalElectorate += wardData.electorate;
					}
				}
			}

			const totalVotes = Object.values(aggregatedVotes).reduce(
				(sum, v) => sum + (v || 0),
				0,
			);
			cached =
				totalVotes > 0
					? {
							partyVotes: aggregatedVotes,
							electorate: totalElectorate,
						}
					: null;
			yearCache.set(year, cached);
		}

		if (cached) {
			rawPartyVotes = cached.partyVotes as PartyVotes;
			if (cached.electorate > 0) {
				const totalVotes = Object.values(cached.partyVotes).reduce(
					(s, v) => s + (v || 0),
					0,
				);
				turnout = calculateTurnout(totalVotes, 0, cached.electorate);
			}
		}
	} else if (
		selectedArea &&
		selectedArea.type === "constituency" &&
		getWardsForConstituency
	) {
		const constituencyCode = selectedArea.code;
		const wardCodes = getWardsForConstituency(
			constituencyCode,
			dataset.boundaryYear,
		);
		const aggregatedVotes: Record<string, number> = {};
		let totalElectorate = 0;

		for (const wardCode of wardCodes) {
			let wardData = dataset.data[wardCode];
			if (!wardData && getCodeForYear) {
				const mapped = getCodeForYear("ward", wardCode, year);
				if (mapped) wardData = dataset.data[mapped];
			}
			if (wardData?.partyVotes) {
				for (const [party, votes] of Object.entries(
					wardData.partyVotes,
				)) {
					aggregatedVotes[party] =
						(aggregatedVotes[party] || 0) + (votes || 0);
				}
				if (wardData.electorate) totalElectorate += wardData.electorate;
			}
		}

		const totalVotes = Object.values(aggregatedVotes).reduce(
			(s, v) => s + (v || 0),
			0,
		);
		if (totalVotes > 0) {
			rawPartyVotes = aggregatedVotes as PartyVotes;
			if (totalElectorate > 0) {
				turnout = calculateTurnout(totalVotes, 0, totalElectorate);
			}
		}
	} else if (selectedArea === null && aggregatedData?.[year]) {
		const agg = aggregatedData[year];
		if (agg) {
			rawPartyVotes = agg.partyVotes;
			turnout = calculateTurnout(agg.totalVotes, 0, agg.electorate);
		}
	}

	if (!rawPartyVotes) {
		return {
			year,
			dataset,
			partyData: [],
			totalVotes: 0,
			turnout: null,
			hasData: false,
		};
	}

	const filteredVotes =
		excluded?.size || selectedParty
			? Object.fromEntries(
					Object.entries(rawPartyVotes).filter(
						([party]) =>
							!excluded?.has(party) &&
							(!selectedParty || party === selectedParty),
					),
				)
			: rawPartyVotes;
	const partyData = processPartyVotes(filteredVotes, dataset.partyInfo);
	const totalVotes = partyData.reduce((a, p) => a + p.votes, 0);

	return {
		year,
		dataset,
		partyData,
		totalVotes,
		turnout,
		hasData: partyData.length > 0,
	};
}
