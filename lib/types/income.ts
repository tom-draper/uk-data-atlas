export interface AnnualIncomeData {
    numberOfJobs: number | null;
    median: number | null;
    medianPercentageChange: number | null;
    mean: number | null;
    meanPercentageChange: number | null;
    percentiles: {
        p10: number | null;
        p20: number | null;
        p25: number | null;
        p30: number | null;
        p40: number | null;
        p60: number | null;
        p70: number | null;
        p75: number | null;
        p80: number | null;
        p90: number | null;
    };
}

export interface HourlyIncomeData {
    numberOfJobs: number | null;
    median: number | null;
    medianPercentageChange: number | null;
    mean: number | null;
    meanPercentageChange: number | null;
    percentiles: {
        p10: number | null;
        p20: number | null;
        p25: number | null;
        p30: number | null;
        p40: number | null;
        p60: number | null;
        p70: number | null;
        p75: number | null;
        p80: number | null;
        p90: number | null;
    };
}

export interface LocalAuthorityIncomeData {
    code: string;
    name: string;
    annual: AnnualIncomeData | null;
    hourly: HourlyIncomeData | null;
}

export interface IncomeDataset {
    id: string;
    type: 'income';
    year: number;
    boundaryType: 'localAuthority';
    boundaryYear: number;
    localAuthorityData: Record<string, LocalAuthorityIncomeData>;
}

export interface AggregatedIncomeData {

}