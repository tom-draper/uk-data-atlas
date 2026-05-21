// lib/types/housePrice.ts
import { WardYear } from "../data/boundaries/boundaries";

export interface HousePriceWardData {
	ladCode: string;
	ladName: string;
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
	data: Record<string, HousePriceWardData>;
}

export type AggregatedHousePriceData = {
	averagePrice: number;
	averagePrices: Record<number, number>;
	wardCount: number;
};
