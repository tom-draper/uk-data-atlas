import { useEffect, useState, useMemo } from 'react';
import { BoundaryGeojson } from '@lib/types';
import { BoundaryType, fetchBoundaryFile, filterFeatures, GEOJSON_PATHS } from '../data/boundaries/boundaries';

export type BoundaryData = {
	ward: Record<number, BoundaryGeojson | null>;
	constituency: Record<number, BoundaryGeojson | null>;
	localAuthority: Record<number, BoundaryGeojson | null>;
};

export function useBoundaryData(selectedLocation?: string | null) {
	const [rawData, setRawData] = useState<BoundaryData>({
		ward: {},
		constituency: {},
		localAuthority: {}
	});

	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		let mounted = true;

		const loadAll = async () => {
			try {
				setIsLoading(true);

				// Generate promises based on config object
				const wYears = Object.keys(GEOJSON_PATHS.ward).map(Number);
				const cYears = Object.keys(GEOJSON_PATHS.constituency).map(Number);
				const lYears = Object.keys(GEOJSON_PATHS.localAuthority).map(Number);

				// Helper to fetch a group
				const fetchGroup = async (type: BoundaryType, years: number[]) => {
					const results: Record<number, BoundaryGeojson> = {};
					await Promise.all(years.map(async (year) => {
						const path = GEOJSON_PATHS[type][year as keyof typeof GEOJSON_PATHS[typeof type]];
						results[year] = await fetchBoundaryFile(path);
					}));
					return results;
				};

				const [wards, constituencies, localAuthorities] = await Promise.all([
					fetchGroup('ward', wYears),
					fetchGroup('constituency', cYears),
					fetchGroup('localAuthority', lYears),
				]);

				if (mounted) {
					setRawData({ ward: wards, constituency: constituencies, localAuthority: localAuthorities });
				}
			} catch (err) {
				if (mounted) setError(err instanceof Error ? err : new Error('Unknown error'));
			} finally {
				if (mounted) setIsLoading(false);
			}
		};

		loadAll();

		return () => { mounted = false; };
	}, []);

	const filteredData = useMemo(() => {
		if (isLoading || !rawData.ward) {
			return {
				ward: { 2024: null, 2023: null, 2022: null, 2021: null },
				constituency: { 2024: null, 2019: null, 2017: null, 2015: null },
				localAuthority: { 2025: null, 2024: null, 2023: null, 2022: null, 2021: null }
			};
		}

		const processGroup = (group: Record<string, BoundaryGeojson | null>, type: 'ward' | 'constituency' | 'localAuthority') => {
			const result: any = {};
			Object.entries(group).forEach(([year, data]) => {
				if (data) {
					result[year] = filterFeatures(data, selectedLocation || null, type);
				} else {
					result[year] = null;
				}
			});
			return result;
		};

		return {
			ward: processGroup(rawData.ward, 'ward'),
			constituency: processGroup(rawData.constituency, 'constituency'),
			localAuthority: processGroup(rawData.localAuthority, 'localAuthority')
		};
	}, [rawData, selectedLocation, isLoading]);

	return { boundaryData: filteredData, isLoading, error };
}