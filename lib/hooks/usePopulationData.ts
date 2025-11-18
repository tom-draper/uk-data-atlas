// lib/hooks/usePopulationData.ts
'use client';
import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { AgeData, PopulationDataset } from '@lib/types';

interface CategoryPopulationWardData {
	[wardCode: string]: {
		ageData: AgeData;
		wardName: string;
		laCode: string;
		laName: string;
	}
}

export const usePopulationData = () => {
	const [datasets, setDatasets] = useState<Record<string, PopulationDataset>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>('');

	useEffect(() => {
		console.log('EXPENSIVE: Loading population data...')
		const loadPopulationData = async () => {
			try {
				// Load 2020 data (separate files for males/females/persons)
				// console.log('Loading population 2020 data...')
				// const [femalesResponse, malesResponse, personsResponse] = await Promise.all([
				// 	fetch('/data/population/Mid-2020 Females-Table 1.csv'),
				// 	fetch('/data/population/Mid-2020 Males-Table 1.csv'),
				// 	fetch('/data/population/Mid-2020 Persons-Table 1.csv'),
				// ]);

				// const [femalesText, malesText, personsText] = await Promise.all([
				// 	femalesResponse.text(),
				// 	malesResponse.text(),
				// 	personsResponse.text(),
				// ]);

				// Load 2021 and 2022 data (combined files)
				console.log('Loading population 2021 and 2022 data...')
				const [data2021Response, data2022Response] = await Promise.all([
					fetch('/data/population/Mid-2021 Ward 2023.csv'),
					fetch('/data/population/Mid-2022 Ward 2023.csv'),
				]);

				const [data2021Text, data2022Text] = await Promise.all([
					data2021Response.text(),
					data2022Response.text(),
				]);

				// Parse 2020 data (old format)
				const parsePopulationData2020 = (csvText: string) => {
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
									ageColumnsStartIndex = allAgesIndex + 1;
									return;
								}

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
							throw new Error(`CSV parsing error: ${parseError}`);
						},
					});

					return data;
				};

				// Parse 2021/2022 data (new format with F0-F90, M0-M90)
				const parsePopulationDataCombined = (csvText: string) => {
					const malesData: CategoryPopulationWardData = {};
					const femalesData: CategoryPopulationWardData = {};
					const totalData: CategoryPopulationWardData = {};

					Papa.parse(csvText, {
						skipEmptyLines: true,
						complete: (results) => {
							let headerRow: any = null;

							results.data.forEach((row: any, index: number) => {
								// Find header row (row 3, index 3)
								if (index === 3) {
									headerRow = row;
									return;
								}

								// Skip rows before data starts (row 4, index 4)
								if (index < 4 || !headerRow) {
									return;
								}

								if (!Array.isArray(row) || row.length < 5) {
									return;
								}

								const laCode = row[0]?.trim();
								const laName = row[1]?.trim() || '';
								const wardCode = row[2]?.trim();
								const wardName = row[3]?.trim() || '';
								const total = row[4]?.trim();

								const femaleAgeData: AgeData = {};
								const maleAgeData: AgeData = {};
								const totalAgeData: AgeData = {};

								// Parse female columns (F0-F90)
								for (let i = 5; i < headerRow.length; i++) {
									const colName = headerRow[i]?.trim();
									if (colName && colName.startsWith('F')) {
										const age = colName.substring(1);
										const value = row[i]?.trim();
										if (value && value !== '') {
											const count = parseInt(value.replace(/,/g, ''), 10);
											if (!isNaN(count)) {
												femaleAgeData[age] = count;
												totalAgeData[age] = (totalAgeData[age] || 0) + count;
											}
										}
									} else if (colName && colName.startsWith('M')) {
										const age = colName.substring(1);
										const value = row[i]?.trim();
										if (value && value !== '') {
											const count = parseInt(value.replace(/,/g, ''), 10);
											if (!isNaN(count)) {
												maleAgeData[age] = count;
												totalAgeData[age] = (totalAgeData[age] || 0) + count;
											}
										}
									}
								}

								if (Object.keys(femaleAgeData).length > 0) {
									femalesData[wardCode] = {
										ageData: femaleAgeData,
										wardName,
										laCode,
										laName
									};
								}

								if (Object.keys(maleAgeData).length > 0) {
									malesData[wardCode] = {
										ageData: maleAgeData,
										wardName,
										laCode,
										laName
									};
								}

								if (Object.keys(totalAgeData).length > 0) {
									totalData[wardCode] = {
										ageData: totalAgeData,
										wardName,
										laCode,
										laName
									};
								}
								// }
							});
						},
						error: (parseError: unknown) => {
							throw new Error(`CSV parsing error: ${parseError}`);
						},
					});

					return { malesData, femalesData, totalData };
				};

				// Parse 2020 data
				// const femalesAgeData = parsePopulationData2020(femalesText);
				// const malesAgeData = parsePopulationData2020(malesText);
				// const totalAgeData = parsePopulationData2020(personsText);

				// // Combine 2020 data
				// const combinedData2020: PopulationDataset['populationData'] = {};
				// const allWardCodes2020 = new Set([
				// 	...Object.keys(femalesAgeData),
				// 	...Object.keys(malesAgeData),
				// 	...Object.keys(totalAgeData),
				// ]);

				// allWardCodes2020.forEach((wardCode) => {
				// 	combinedData2020[wardCode] = {
				// 		total: totalAgeData[wardCode]?.ageData || {},
				// 		males: malesAgeData[wardCode]?.ageData || {},
				// 		females: femalesAgeData[wardCode]?.ageData || {},
				// 		wardName: totalAgeData[wardCode]?.wardName || '',
				// 		laCode: totalAgeData[wardCode]?.laCode || '',
				// 		laName: totalAgeData[wardCode]?.laName || '',
				// 	};
				// });

				// Parse 2021 data
				const parsed2021 = parsePopulationDataCombined(data2021Text);
				const combinedData2021: PopulationDataset['populationData'] = {};
				const allWardCodes2021 = new Set([
					...Object.keys(parsed2021.femalesData),
					...Object.keys(parsed2021.malesData),
					...Object.keys(parsed2021.totalData),
				]);

				allWardCodes2021.forEach((wardCode) => {
					combinedData2021[wardCode] = {
						total: parsed2021.totalData[wardCode]?.ageData || {},
						males: parsed2021.malesData[wardCode]?.ageData || {},
						females: parsed2021.femalesData[wardCode]?.ageData || {},
						wardName: parsed2021.totalData[wardCode]?.wardName || '',
						laCode: parsed2021.totalData[wardCode]?.laCode || '',
						laName: parsed2021.totalData[wardCode]?.laName || '',
					};
				});

				// Parse 2022 data
				const parsed2022 = parsePopulationDataCombined(data2022Text);
				const combinedData2022: PopulationDataset['populationData'] = {};
				const allWardCodes2022 = new Set([
					...Object.keys(parsed2022.femalesData),
					...Object.keys(parsed2022.malesData),
					...Object.keys(parsed2022.totalData),
				]);

				allWardCodes2022.forEach((wardCode) => {
					combinedData2022[wardCode] = {
						total: parsed2022.totalData[wardCode]?.ageData || {},
						males: parsed2022.malesData[wardCode]?.ageData || {},
						females: parsed2022.femalesData[wardCode]?.ageData || {},
						wardName: parsed2022.totalData[wardCode]?.wardName || '',
						laCode: parsed2022.totalData[wardCode]?.laCode || '',
						laName: parsed2022.totalData[wardCode]?.laName || '',
					};
				});

				// Create datasets
				// const population2020: PopulationDataset = {
				// 	id: 'population-2020',
				// 	name: 'Population 2020',
				// 	type: 'population',
				// 	year: 2020,
				// 	wardYear: 2021,
				// 	boundaryType: 'ward',
				// 	populationData: combinedData2020,
				// };

				const population2021: PopulationDataset = {
					id: 'population-2021',
					name: 'Population 2021',
					type: 'population',
					year: 2021,
					wardYear: 2023,
					boundaryType: 'ward',
					populationData: combinedData2021,
				};

				const population2022: PopulationDataset = {
					id: 'population-2022',
					name: 'Population 2022',
					type: 'population',
					year: 2022,
					wardYear: 2023,
					boundaryType: 'ward',
					populationData: combinedData2022,
				};

				const loadedDatasets: Record<string, PopulationDataset> = {
					'population-2021': population2021,
					'population-2022': population2022,
				};

				console.log('Storing population datasets:', loadedDatasets);
				setDatasets(loadedDatasets);
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

	return { datasets, loading, error };
};