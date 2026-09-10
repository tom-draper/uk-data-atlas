import type { PopulationCodeResolver } from "@/lib/data/boundaries/codeMapper";
import type {
	AggregatedHousePriceData,
	HousePriceDataset,
	SelectedArea,
} from "@/lib/types";
import type { HousePriceOptions } from "@/lib/types/mapOptions";

type HousePriceMeasure = HousePriceOptions["measure"];

export type HousePricePoint = {
	year: number;
	price: number;
};

export type HousePriceSeries = {
	priceData: HousePricePoint[];
	currentPrice: number | null;
};

export type HousePriceSeriesInput = {
	dataset: HousePriceDataset;
	aggregatedData: Record<number, AggregatedHousePriceData> | null;
	selectedArea: SelectedArea | null;
	measure: HousePriceMeasure;
	codeMapper?: Pick<
		PopulationCodeResolver,
		"getCodeForYear" | "getWardsForLad" | "getWardsForConstituency"
	>;
};

const emptySeries = (): HousePriceSeries => ({
	priceData: [],
	currentPrice: null,
});

const seriesFromPrices = (
	prices: Record<number, number>,
): HousePriceSeries => ({
	priceData: Object.entries(prices)
		.filter(([, price]) => price !== null && price !== undefined)
		.sort(([a], [b]) => Number(a) - Number(b))
		.map(([year, price]) => ({ year: Number(year), price })),
	currentPrice: prices[2023] || null,
});

const median = (values: number[]): number => {
	const sorted = values.toSorted((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? (sorted[middle - 1] + sorted[middle]) / 2
		: sorted[middle];
};

const pricesFor = (
	ward: HousePriceDataset["data"][string],
	measure: HousePriceMeasure,
) => (measure === "mean" ? ward.meanPrices : ward.prices);

const aggregateWardPrices = (
	dataset: HousePriceDataset,
	wardCodes: string[],
	mapper: HousePriceSeriesInput["codeMapper"],
	mappingYear: number,
	measure: HousePriceMeasure,
): Record<number, number> => {
	const valuesByYear: Record<number, number[]> = {};

	for (const wardCode of wardCodes) {
		let wardData = dataset.data[wardCode];
		if (!wardData && mapper) {
			const mappedCode = mapper.getCodeForYear(
				"ward",
				wardCode,
				mappingYear,
			);
			if (mappedCode) wardData = dataset.data[mappedCode];
		}

		for (const [year, price] of Object.entries(
			wardData ? pricesFor(wardData, measure) : {},
		)) {
			if (price === null || price === undefined) continue;
			(valuesByYear[Number(year)] ??= []).push(price);
		}
	}

	return Object.fromEntries(
		Object.entries(valuesByYear)
			.filter(([, prices]) => prices.length > 0)
			.map(([year, prices]) => [Number(year), median(prices)]),
	);
};

/** Resolves one dataset's display series without retaining state between calls. */
export const resolveHousePriceSeries = ({
	dataset,
	aggregatedData,
	selectedArea,
	measure,
	codeMapper,
}: HousePriceSeriesInput): HousePriceSeries => {
	if (selectedArea === null) {
		const aggregate = aggregatedData?.[dataset.year];
		return aggregate
			? seriesFromPrices(
					measure === "mean"
						? aggregate.averageMeanPrices
						: aggregate.averagePrices,
				)
			: emptySeries();
	}

	if (selectedArea.type === "ward") {
		let wardData = dataset.data[selectedArea.code];
		if (!wardData && codeMapper) {
			const mappedCode = codeMapper.getCodeForYear(
				"ward",
				selectedArea.code,
				dataset.boundaryYear,
			);
			if (mappedCode) wardData = dataset.data[mappedCode];
		}
		return wardData
			? seriesFromPrices(pricesFor(wardData, measure))
			: emptySeries();
	}

	if (selectedArea.type === "localAuthority" && codeMapper) {
		const wardCodes = codeMapper.getWardsForLad(selectedArea.code, 2022);
		return seriesFromPrices(
			aggregateWardPrices(dataset, wardCodes, codeMapper, 2022, measure),
		);
	}

	if (selectedArea.type === "constituency" && codeMapper) {
		const wardCodes = codeMapper.getWardsForConstituency(
			selectedArea.code,
			dataset.boundaryYear,
		);
		return seriesFromPrices(
			aggregateWardPrices(
				dataset,
				wardCodes,
				codeMapper,
				dataset.boundaryYear,
				measure,
			),
		);
	}

	return emptySeries();
};

/** Bounds memoized area lookups while allowing refreshed mappings to invalidate them. */
export class HousePriceSeriesCache {
	private readonly entries = new Map<string, HousePriceSeries>();
	private readonly datasetIds = new WeakMap<object, number>();
	private nextDatasetId = 0;

	constructor(private readonly maxEntries = 50) {}

	resolve(
		input: HousePriceSeriesInput,
		mappingGeneration: number,
	): HousePriceSeries {
		if (input.selectedArea === null) return resolveHousePriceSeries(input);

		const key = this.keyFor(input, mappingGeneration);
		const cached = this.entries.get(key);
		if (cached) return cached;

		const series = resolveHousePriceSeries(input);
		if (this.entries.size >= this.maxEntries) {
			const oldestKey = this.entries.keys().next().value;
			if (oldestKey) this.entries.delete(oldestKey);
		}
		this.entries.set(key, series);
		return series;
	}

	private keyFor(
		{ dataset, selectedArea, measure }: HousePriceSeriesInput,
		mappingGeneration: number,
	): string {
		let datasetId = this.datasetIds.get(dataset);
		if (datasetId === undefined) {
			datasetId = this.nextDatasetId++;
			this.datasetIds.set(dataset, datasetId);
		}
		return `${selectedArea!.type}-${selectedArea!.code}:${datasetId}:${mappingGeneration}:${measure}`;
	}
}
