import { BoundaryType } from "./boundaries";

export interface CustomDataset {
    type: 'custom';
    name: string;
	year: number;
    boundaryType: BoundaryType;
    boundaryYear: number;
    dataColumn: string;
    data: { [key: string]: number };
}

export type AggregatedCustomData = {
    average: number;
    count: number;
}