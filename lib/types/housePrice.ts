// lib/types/housePrice.ts
// House price data types

import { WardYear } from "../data/boundaries/boundaries";

export interface WardHousePriceData {
    localAuthorityCode: string;
    localAuthorityName: string;
    wardCode: string;
    wardName: string;
    prices: Record<number, number>;
}

export interface HousePriceDataset {
    id: string;
    type: 'housePrice';
    year: number;
    boundaryYear: WardYear;
    boundaryType: 'ward';
    wardData: Record<string, WardHousePriceData>;
}

export interface AggregatedHousePriceData {
    2023: {
        averagePrice: number;
        averagePrices: Record<number, number>;
        wardCount: number;
    };
}
