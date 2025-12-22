// lib/types/housePrice.ts
import { WardYear } from "../data/boundaries/boundaries";

export interface WardHousePriceData {
	localAuthorityCode: string;
	localAuthorityName: string;
	wardCode: string;
	wardName: string;
	prices: Record<number, number>;
}

export type HousePriceYear = 2023;

export interface HousePriceDataset {
	id: string;
	type: "housePrice";
	year: HousePriceYear;
	boundaryYear: WardYear;
	boundaryType: "ward";
	data: Record<string, WardHousePriceData>;
}

export type AggregatedHousePriceData = {
	[Y in HousePriceYear]: {
		averagePrice: number;
		averagePrices: Record<number, number>;
		wardCount: number;
	};
};
