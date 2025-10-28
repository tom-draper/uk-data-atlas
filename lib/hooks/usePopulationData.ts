// lib/hooks/usePopulationData.ts
'use client';
import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { PopulationWardData, AgeData, Dataset } from '@lib/types';

interface CategoryPopulationWardData {
	[wardCode: string]: {
		ageData: AgeData;
		wardName: string;
		laCode: string;
		laName: string;
	}
}

export const usePopulationData = () => {
	const [datasets, setDatasets] = useState<Dataset[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>('');

	useEffect(() => {
		const loadPopulationData = async () => {
			console.log('EXPENSIVE: Loading population data...')
			try {
				const [femalesResponse, malesResponse, personsResponse] = await Promise.all([
					fetch('/data/age/Mid-2020 Females-Table 1.csv'),
					fetch('/data/age/Mid-2020 Males-Table 1.csv'),
					fetch('/data/age/Mid-2020 Persons-Table 1.csv'),
				]);

				const [femalesText, malesText, personsText] = await Promise.all([
					femalesResponse.text(),
					malesResponse.text(),
					personsResponse.text(),
				]);

				const parsePopulationData = (csvText: string) => {
					const data: CategoryPopulationWardData = {};
					let wardCodeIndex = -1;
					let wardNameIndex = -1;
					let laCodeIndex = -1;
					let laNameIndex = -1;
					let allAgesIndex = -1;
					let ageColumnsStartIndex = -1;

					Papa.parse(csvText, {
						skipEmptyLines: true,
						complete: (results) => {
							results.data.forEach((row: any, index: number) => {
								// Find indices from header row (row 4, index 4)
								if (index === 4) {
									wardCodeIndex = row.findIndex((col: any) =>
										col?.trim?.()?.includes('Ward Code')
									);
									wardNameIndex = row.findIndex((col: any) =>
										col?.trim?.()?.includes('Ward Name')
									);
									laCodeIndex = row.findIndex((col: any) =>
										col?.trim?.()?.includes('LA Code')
									);
									laNameIndex = row.findIndex((col: any) =>
										col?.trim?.()?.includes('LA name')
									);
									allAgesIndex = row.findIndex(
										(col: any) => col?.trim?.() === 'All Ages'
									);
									// Age columns start after "All Ages" (typically index 5)
									ageColumnsStartIndex = allAgesIndex + 1;
									return;
								}

								// Skip rows before header
								if (index <= 4) {
									return;
								}

								if (!Array.isArray(row) || row.length < ageColumnsStartIndex) {
									return;
								}

								const wardCode = row[wardCodeIndex]?.trim();
								const wardName = row[wardNameIndex]?.trim() || '';
								const laCode = row[laCodeIndex]?.trim() || '';
								const laName = row[laNameIndex]?.trim() || '';

								if (wardCode && wardCode.startsWith('E05')) {
									const ageData: AgeData = {};

									// Extract all age columns starting from ageColumnsStartIndex
									for (let i = ageColumnsStartIndex; i < row.length; i++) {
										const ageValue = row[i]?.trim();
										if (ageValue && ageValue !== '') {
											const age = String(i - ageColumnsStartIndex);
											const count = parseInt(ageValue.replace(/,/g, ''), 10);
											if (!isNaN(count)) {
												ageData[age] = count;
											}
										}
									}

									if (Object.keys(ageData).length > 0) {
										data[wardCode] = {
											ageData,
											wardName,
											laCode,
											laName
										};
									}
								}
							});
						},
						error: (parseError: unknown) => {
							throw new Error(
								`CSV parsing error: ${parseError}`
							);
						},
					});

					return data;
				};

				const femalesAgeData = parsePopulationData(femalesText);
				const malesAgeData = parsePopulationData(malesText);
				const totalAgeData = parsePopulationData(personsText);

				// Combine into single structure with males, females, and total per ward
				const combinedData: PopulationWardData = {};

				const allWardCodes = new Set([
					...Object.keys(femalesAgeData),
					...Object.keys(malesAgeData),
					...Object.keys(totalAgeData),
				]);

				allWardCodes.forEach((wardCode) => {
					combinedData[wardCode] = {
						total: totalAgeData[wardCode].ageData || {},
						males: malesAgeData[wardCode].ageData || {},
						females: femalesAgeData[wardCode].ageData || {},
						wardName: totalAgeData[wardCode].wardName,
						laCode: totalAgeData[wardCode].laCode,
						laName: totalAgeData[wardCode].laName,
					};
				});

				const populationDatasetsArray: Dataset[] = [
					{
						id: 'pop-persons',
						name: 'Population (Total) 2020',
						year: 2020,
						type: 'population',
						populationData: combinedData,
						partyInfo: [
							{ key: 'TOTAL', name: 'Total Population', color: '#3b82f6' }
						],
					},
				];
				console.log('Storing population data:', populationDatasetsArray);
				setDatasets(populationDatasetsArray);

				setLoading(false);
			} catch (err) {
				console.error('Population data loading error:', err);
				setError(
					err instanceof Error ? err.message : 'Failed to load population data'
				);
				setLoading(false);
			}
		};

		loadPopulationData();
	}, []);

	return { datasets: datasets, loading, error };
};