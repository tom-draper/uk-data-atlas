// lib/hooks/useGeneralElectionData.ts
import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { PARTY_INFO } from '../data/parties';
import { ConstituencyData, GeneralElectionDataset } from '../types';

// Common party abbreviations in general elections
const KNOWN_PARTIES_2024 = ['Con', 'Lab', 'LD', 'RUK', 'Green', 'SNP', 'PC', 'DUP', 'SF', 'SDLP', 'UUP', 'APNI'];
const KNOWN_PARTIES_PRE_2024 = ['Con', 'Lab', 'LD', 'BRX', 'Green', 'SNP', 'PC', 'DUP', 'SF', 'SDLP', 'UUP', 'APNI', 'UKIP'];

// Utility to parse vote counts efficiently
const parseVotes = (value: any): number => {
	if (!value || value === '') return 0;
	const parsed = parseInt(String(value).replace(/,/g, '').trim());
	return isNaN(parsed) ? 0 : parsed;
};



const parseGeneralElection2024 = async (): Promise<GeneralElectionDataset> => {
	console.log('Loading general election 2024 data...');
	const res = await fetch('/data/elections/general-elections/HoC-GE2024-results-by-constituency.csv');
	const csvText = await res.text();

	// Skip header rows (first 2 lines)
	const lines = csvText.split('\n');
	const dataStart = lines.findIndex(line => line.includes('ONS ID'));
	const cleanedCsv = lines.slice(dataStart).join('\n');

	return new Promise((resolve, reject) => {
		Papa.parse(cleanedCsv, {
			header: true,
			skipEmptyLines: true,
			dynamicTyping: false,
			complete: (results) => {
				const constituencyResults: Record<string, string> = {};
				const constituencyData: Record<string, ConstituencyData> = {};

				for (const row of results.data as any[]) {
					const onsId = row['ONS ID']?.trim();
					if (!onsId) continue;

					// Parse party votes
					const partyVotes: Record<string, number> = {};
					for (const party of KNOWN_PARTIES_2024) {
						const votes = parseVotes(row[party]);
						if (votes > 0) {
							partyVotes[party.toUpperCase()] = votes;
						}
					}

					// Parse "All other candidates" as OTHER
					const otherVotes = parseVotes(row['All other candidates']);
					if (otherVotes > 0) {
						partyVotes['OTHER'] = otherVotes;
					}

					// Get winning party from "First party" column
					const winningParty = row['First party']?.trim().toUpperCase() || 'OTHER';

					const electorate = parseVotes(row['Electorate']);
					const validVotes = parseVotes(row['Valid votes']);
					const invalidVotes = parseVotes(row['Invalid votes']);

					constituencyResults[onsId] = winningParty;
					constituencyData[onsId] = {
						constituencyName: row['Constituency name'] || 'Unknown',
						onsId,
						regionName: row['Region name'] || 'Unknown',
						countryName: row['Country name'] || 'Unknown',
						constituencyType: row['Constituency type'] || 'Unknown',
						memberFirstName: row['Member first name'] || '',
						memberSurname: row['Member surname'] || '',
						memberGender: row['Member gender'] || '',
						result: row['Result'] || '',
						firstParty: row['First party'] || '',
						secondParty: row['Second party'] || '',
						electorate,
						validVotes,
						invalidVotes,
						majority: parseVotes(row['Majority']),
						// turnoutPercent: calculateTurnout(validVotes, invalidVotes, electorate),
						partyVotes
					};
				}

				resolve({
					id: 'general-2024',
					type: 'general-election',
					name: 'General Election 2024',
					year: 2024,
					constituencyYear: 2024,
					boundaryType: 'constituency',
					constituencyResults,
					constituencyData,
					partyInfo: PARTY_INFO
				});
			},
			error: reject
		});
	});
};

const parseGeneralElectionPre2024 = async (year: 2019 | 2017 | 2015): Promise<GeneralElectionDataset> => {
	console.log(`Loading general election ${year} data...`);
	const res = await fetch(`/data/elections/general-elections/HoC-GE${year}-results-by-constituency.csv`);
	const csvText = await res.text();

	return new Promise((resolve, reject) => {
		Papa.parse(csvText, {
			header: true,
			skipEmptyLines: true,
			dynamicTyping: false,
			complete: (results) => {
				const constituencyResults: Record<string, string> = {};
				const constituencyData: Record<string, ConstituencyData> = {};

				for (const row of results.data as any[]) {
					const onsId = row['ONS ID']?.trim();
					if (!onsId) continue;

					// Parse party votes
					const partyVotes: Record<string, number> = {};
					for (const party of KNOWN_PARTIES_PRE_2024) {
						const votes = parseVotes(row[party]);
						if (votes > 0) {
							partyVotes[party.toUpperCase()] = votes;
						}
					}

					// Parse "All other candidates" as OTHER
					const otherVotes = parseVotes(row['All other candidates']);
					if (otherVotes > 0) {
						partyVotes['OTHER'] = otherVotes;
					}

					// Check if another party won (not in main columns)
					const otherWinner = row['Of which other winner'];
					if (otherWinner && parseVotes(otherWinner) > 0) {
						// The other winner's votes are included in "All other candidates"
						// but we need to identify which party won
					}

					// Get winning party from "First party" column
					const winningParty = row['First party']?.trim().toUpperCase() || 'OTHER';

					const electorate = parseVotes(row['Electorate']);
					const validVotes = parseVotes(row['Valid votes']);
					const invalidVotes = parseVotes(row['Invalid votes']);

					constituencyResults[onsId] = winningParty;
					constituencyData[onsId] = {
						constituencyName: row['Constituency name'] || 'Unknown',
						onsId,
						regionName: row['Region name'] || 'Unknown',
						countryName: row['Country name'] || 'Unknown',
						constituencyType: row['Constituency type'] || 'Unknown',
						memberFirstName: row['Member first name'] || '',
						memberSurname: row['Member surname'] || '',
						memberGender: row['Member gender'] || '',
						result: row['Result'] || '',
						firstParty: row['First party'] || '',
						secondParty: row['Second party'] || '',
						electorate,
						validVotes,
						invalidVotes,
						majority: parseVotes(row['Majority']),
						// turnoutPercent: calculateTurnout(validVotes, invalidVotes, electorate),
						partyVotes
					};
				}

				resolve({
					id: `general-${year}`,
					type: 'general-election',
					name: `General Election ${year}`,
					year,
					constituencyYear: year,
					boundaryType: 'constituency',
					constituencyResults,
					constituencyData,
					partyInfo: PARTY_INFO
				});
			},
			error: reject
		});
	});
};

export const useGeneralElectionData = () => {
	const [datasets, setDatasets] = useState<Record<string, GeneralElectionDataset>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>('');

	useEffect(() => {
		const loadData = async () => {
			try {
				console.log('EXPENSIVE: Loading general election data...');

				const [data2024, data2019, data2017, data2015] = await Promise.all([
					parseGeneralElection2024().catch(err => {
						console.error('2024 general election load failed:', err);
						return null;
					}),
					parseGeneralElectionPre2024(2019).catch(err => {
						console.error('2019 general election load failed:', err);
						return null;
					}),
					parseGeneralElectionPre2024(2017).catch(err => {
						console.error('2017 general election load failed:', err);
						return null;
					}),
					parseGeneralElectionPre2024(2015).catch(err => {
						console.error('2015 general election load failed:', err);
						return null;
					})
				]);

				const loadedDatasets: Record<string, GeneralElectionDataset> = {};
				
				if (data2024) loadedDatasets['general-2024'] = data2024;
				if (data2019) loadedDatasets['general-2019'] = data2019;
				if (data2017) loadedDatasets['general-2017'] = data2017;
				if (data2015) loadedDatasets['general-2015'] = data2015;

				console.log('Storing general election datasets:', loadedDatasets);
				setDatasets(loadedDatasets);
				setLoading(false);
			} catch (err: any) {
				setError(err.message || 'Error loading general election data');
				setLoading(false);
			}
		};

		loadData();
	}, []);

	return { datasets, loading, error };
};