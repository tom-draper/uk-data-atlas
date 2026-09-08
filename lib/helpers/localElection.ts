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

// Cache area vote aggregations by area, dataset slice and election year.
// The mapping generation invalidates results created before constituency ward
// mappings arrive or before the current location's election codes are mapped.
const MAX_AREA_CACHE_ENTRIES = 50;
const localElectionAreaCache = new Map<
	string,
	Map<
		number,
		{ partyVotes: Record<string, number>; electorate: number } | null
	>
>();
const localElectionDatasetIds = new WeakMap<object, number>();
let nextLocalElectionDatasetId = 0;

const localElectionCacheKey = (
	areaKey: string,
	dataset: object,
	mappingGeneration: number,
) => {
	let datasetId = localElectionDatasetIds.get(dataset);
	if (datasetId === undefined) {
		datasetId = nextLocalElectionDatasetId++;
		localElectionDatasetIds.set(dataset, datasetId);
	}
	return `${areaKey}:${datasetId}:${mappingGeneration}`;
};

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
	mappingGeneration: number,
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
			// The LEAP archive publishes candidate votes but no electorate, so
			// its wards carry a zero turnout meaning "not recorded". Treat it
			// as absent, the way the area branches below already do.
			turnout = data.turnoutPercent || null;
		}
	} else if (
		selectedArea &&
		selectedArea.type === "localAuthority" &&
		getWardsForLad
	) {
		const ladCode = selectedArea.code;
		const cacheKey = localElectionCacheKey(
			`lad-${ladCode}`,
			dataset,
			mappingGeneration,
		);

		// Check cache first
		if (!localElectionAreaCache.has(cacheKey)) {
			if (localElectionAreaCache.size >= MAX_AREA_CACHE_ENTRIES) {
				localElectionAreaCache.delete(
					localElectionAreaCache.keys().next().value!,
				);
			}
			localElectionAreaCache.set(cacheKey, new Map());
		}
		const yearCache = localElectionAreaCache.get(cacheKey)!;

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
		const cacheKey = localElectionCacheKey(
			`constituency-${constituencyCode}`,
			dataset,
			mappingGeneration,
		);
		if (!localElectionAreaCache.has(cacheKey)) {
			if (localElectionAreaCache.size >= MAX_AREA_CACHE_ENTRIES) {
				localElectionAreaCache.delete(
					localElectionAreaCache.keys().next().value!,
				);
			}
			localElectionAreaCache.set(cacheKey, new Map());
		}
		const yearCache = localElectionAreaCache.get(cacheKey)!;

		let cached = yearCache.get(year);
		if (!yearCache.has(year)) {
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
					if (wardData.electorate)
						totalElectorate += wardData.electorate;
				}
			}

			const totalVotes = Object.values(aggregatedVotes).reduce(
				(s, v) => s + (v || 0),
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
