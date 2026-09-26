export interface MobileCoverageLADData {
	ladCode: string;
	ladName: string;
	/** Premises with indoor 4G from all four operators, as a percentage. */
	pct4GIndoorAll: number | null;
	/** Premises with indoor 4G from at least one operator. */
	pct4GIndoorAny: number | null;
	/** Premises with outdoor 5G from all four operators. */
	pct5GOutdoorAll: number | null;
	/** Premises with outdoor 5G from at least one operator. */
	pct5GOutdoorAny: number | null;
	/** Landmass with outdoor 4G from all four operators. */
	pct4GGeoAll: number | null;
	/** Landmass with outdoor 5G from at least one operator. */
	pct5GGeoAny: number | null;
	premisesCount: number | null;
}

export interface MobileCoverageDataset {
	id: string;
	type: "mobileCoverage";
	year: number;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, MobileCoverageLADData>;
}

export interface AggregatedMobileCoverageData {
	pct4GIndoorAll: number | null;
	pct4GIndoorAny: number | null;
	pct5GOutdoorAll: number | null;
	pct5GOutdoorAny: number | null;
	pct4GGeoAll: number | null;
	pct5GGeoAny: number | null;
}
