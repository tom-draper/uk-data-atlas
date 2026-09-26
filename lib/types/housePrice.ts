// lib/types/housePrice.ts
import { WardYear } from "../data/boundaries/boundaries";

export interface HousePriceWardData {
	ladCode: string;
	ladName: string;
	wardCode: string;
	wardName: string;
	/**
	 * The code the publisher used, where the loader moved the ward onto a
	 * newer one so the map joins. Absent when the two are the same.
	 */
	sourceWardCode?: string;
	/** Median price paid, by calendar year. */
	prices: Record<number, number>;
	/** Mean price paid, by calendar year. */
	meanPrices: Record<number, number>;
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
	averageMeanPrice: number;
	averageMeanPrices: Record<number, number>;
	wardCount: number;
};
