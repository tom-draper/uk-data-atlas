// lib/utils/electionUtils.ts
import Papa from "papaparse";
import { LocalElectionDataset, WardData, LocalElectionYear } from "@lib/types/index";
import { WardYear } from "@/lib/data/boundaries/boundaries";
import { PARTY_INFO } from "@/lib/data/election/parties";
import { ElectionSourceConfig } from "./config";

const KNOWN_PARTIES = ["LAB", "CON", "LD", "GREEN", "REF", "IND"];

const detectPartyColumns = (headers: string[]) =>
	headers.filter((h) => KNOWN_PARTIES.includes(h.toUpperCase().trim()));

const parseNumber = (val: any) => {
	if (!val) return 0;
	const clean = String(val).replace(/,|%/g, "").trim();
	const num = parseFloat(clean);
	return isNaN(num) ? 0 : num;
};

const findWinner = (votes: Record<string, number>): string => {
	return Object.entries(votes).reduce(
		(winner, [party, count]) =>
			count > (votes[winner] || 0) ? party : winner,
		"OTHER",
	);
};

export const fetchAndParseCsv = async (
	config: ElectionSourceConfig,
): Promise<LocalElectionDataset> => {
	const res = await fetch(config.url);
	let text = await res.text();

	// Heuristic: Skip metadata lines if they exist (detecting "Local authority name")
	// This replaces the hardcoded line splitting
	if (!text.startsWith(config.fields.ladName) && !text.startsWith("WD24")) {
		const lines = text.split("\n");
		const headerIndex = lines.findIndex(
			(l) =>
				l.includes(config.fields.name) ||
				l.includes(config.fields.ladName),
		);
		if (headerIndex > -1) text = lines.slice(headerIndex).join("\n");
	}

	return new Promise((resolve, reject) => {
		Papa.parse(text, {
			header: true,
			skipEmptyLines: true,
			transformHeader: (h) => h.trim(),
			complete: (results) => {
				const partyCols = detectPartyColumns(results.meta.fields || []);
				const wardWinners: Record<string, string> = {};
				const wardData: Record<string, WardData> = {};
				const unmapped: any[] = [];

					results.data.forEach((row: any) => {
					// Extract party votes
					const partyVotes: Record<string, number> = {};
					partyCols.forEach(
						(p) => (partyVotes[p] = parseNumber(row[p])),
					);

					// Normalize core data
					const laName =
						row[config.fields.ladName] ||
						row["COUNTYNAME"] ||
						"Unknown"; // Fallback for 2023
					const wName = row[config.fields.name];
					const rawCode = row[config.fields.code]?.trim();
					const wCode = rawCode && config.wardCodeMap?.[rawCode] ? config.wardCodeMap[rawCode] : rawCode;

					const entry: WardData = {
						wardCode: wCode,
						wardName: wName,
						localAuthorityName: laName,
						localAuthorityCode:
							row[config.fields.ladCode || ""] || "Unknown",
						turnoutPercent: parseNumber(row[config.fields.turnout]),
						electorate: parseNumber(row[config.fields.electorate]),
						totalVotes: parseNumber(
							row[config.fields.totalVotes || ""],
						),
						partyVotes,
					};

					// Handle mapped vs unmapped (2023 case)
					if (wCode) {
						wardWinners[wCode] = findWinner(partyVotes);
						wardData[wCode] = entry;
					} else {
						// Store raw unmapped data for post-processing
						unmapped.push({
							...entry,
							winningParty: findWinner(partyVotes),
						});
					}
				});

					resolve({
					id: `localElection${config.year}`,
					type: "localElection",
					year: config.year as LocalElectionYear,
					boundaryYear: (config.boundaryYear ?? config.year) as WardYear,
					boundaryType: "ward",
					results: wardWinners,
					data: wardData,
					partyInfo: PARTY_INFO,
					// @ts-ignore - attaching temporary unmapped data
					_unmapped: unmapped.length > 0 ? unmapped : undefined,
				});
			},
			error: reject,
		});
	});
};

/**
 * Remap any ward codes in a dataset that don't exist in the expected boundary
 * year's code set. Uses the cross-year code mapper as an automatic fallback,
 * covering cases where the source data carries codes from a different boundary
 * revision than the GeoJSON the dataset is paired with.
 */
export const normalizeElectionDatasetCodes = (
	dataset: LocalElectionDataset,
	validWardCodes: Set<string>,
	getCodeForYear: (type: "ward", code: string, targetYear: number) => string | undefined,
): LocalElectionDataset => {
	const { boundaryYear } = dataset;
	const remapped: Record<string, string> = {};

	for (const code of Object.keys(dataset.results)) {
		if (!validWardCodes.has(code)) {
			const mapped = getCodeForYear("ward", code, boundaryYear);
			if (mapped && validWardCodes.has(mapped)) {
				remapped[code] = mapped;
			}
		}
	}

	if (Object.keys(remapped).length === 0) return dataset;

	const newResults = { ...dataset.results };
	const newData = { ...dataset.data };

	for (const [oldCode, newCode] of Object.entries(remapped)) {
		if (newResults[oldCode] !== undefined) {
			newResults[newCode] = newResults[oldCode];
			delete newResults[oldCode];
		}
		if (newData[oldCode] !== undefined) {
			newData[newCode] = { ...newData[oldCode], wardCode: newCode };
			delete newData[oldCode];
		}
	}

	return { ...dataset, results: newResults, data: newData };
};

export const reconcile2023Data = (
	dataset2023: LocalElectionDataset,
	referenceSets: LocalElectionDataset[],
): LocalElectionDataset => {
	// @ts-ignore
	if (!dataset2023._unmapped) return dataset2023;

	// Build Lookup Map
	const lookup = new Map<string, string>();
	referenceSets.forEach((ds) => {
		Object.entries(ds.data).forEach(([code, data]) => {
			const key =
				`${data.localAuthorityName}|${data.wardName}`.toLowerCase();
			if (!lookup.has(key)) lookup.set(key, code);
		});
	});

	// Apply lookup
	// @ts-ignore
	dataset2023._unmapped.forEach((item: any) => {
		const key = `${item.localAuthorityName}|${item.wardName}`.toLowerCase();
		const code = lookup.get(key);

		if (code) {
			dataset2023.results[code] = item.winningParty;
			dataset2023.data[code] = {
				...item,
				localAuthorityCode: code.substring(0, 9), // Infer LA code from Ward Code
			};
		}
	});

	// cleanup
	// @ts-ignore
	delete dataset2023._unmapped;
	return dataset2023;
};
