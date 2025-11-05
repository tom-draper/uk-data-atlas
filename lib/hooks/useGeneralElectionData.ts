// lib/hooks/useGeneralElectionData.ts
import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { PARTY_INFO } from '../data/parties';
import { GeneralElectionDataset } from '../types';



// Common party abbreviations in general elections
const KNOWN_PARTIES = ['Con', 'Lab', 'LD', 'RUK', 'Green', 'SNP', 'PC', 'DUP', 'SF', 'SDLP', 'UUP', 'APNI'];

// Utility to parse vote counts efficiently
const parseVotes = (value: any): number => {
	if (!value || value === '') return 0;
	const parsed = parseInt(String(value).replace(/,/g, '').trim());
	return isNaN(parsed) ? 0 : parsed;
};

// Calculate turnout percentage from electorate and valid votes
const calculateTurnout = (validVotes: number, invalidVotes: number, electorate: number): number | undefined => {
	if (!electorate || electorate === 0) return undefined;
	const totalVotes = validVotes + invalidVotes;
	return (totalVotes / electorate) * 100;
};

const parseGeneralElection2024 = async (): Promise<GeneralElectionDataset> => {
	const res = await fetch('/data/elections/general-elections/HoC-GE2024-results-by-constituency/Data-Table 1.csv');
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
					for (const party of KNOWN_PARTIES) {
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
						turnoutPercent: calculateTurnout(validVotes, invalidVotes, electorate),
						...partyVotes
					};
				}

				resolve({
					id : 'general-2024',
					type: 'general-election',
					name: 'General Election 2024',
					year: 2024,
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
	const [datasets, setDatasets] = useState<Record<string, GeneralElectionDataset | null>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>('');

	useEffect(() => {
		const loadData = async () => {
			try {
				console.log('EXPENSIVE: Loading general election data...');

				const data2024 = await parseGeneralElection2024().catch(err => {
					console.error('2024 general election load failed:', err);
					return null;
				});

				console.log('Sample constituencyResults:', Object.entries(data2024?.constituencyResults).slice(0, 2));
				console.log('Sample constituencyData:', Object.entries(data2024?.constituencyData).slice(0, 2));

				const loadedDatasets = {
					'general-2024': data2024,
				}

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