// lib/utils/mapManager/mapManager.ts
import {
	BoundaryGeojson,
	LocalElectionDataset,
	GeneralElectionDataset,
	PopulationDataset,
	HousePriceDataset,
	CrimeDataset,
	EthnicityDataset,
	PropertyKeys,
	CustomDataset,
	Features,
	BrexitLADDataset,
	BrexitConstituencyDataset,
} from "@lib/types";
import { MapMode, MapOptions } from "@lib/types/mapOptions";
import { LayerManager } from "./layerManager";
import { EventHandler } from "./eventHandler";
import { StatsCalculator } from "./statsCalculator";
import { FeatureBuilder } from "./featureBuilder";
import { PropertyDetector } from "./propertyDetector";
import { StatsCache } from "./statsCache";
import { IncomeDataset } from "@/lib/types/income";
import { IMDDataset } from "@/lib/types/imd";
import { SIMDDataset } from "@/lib/types/simd";
import { WIMDDataset } from "@/lib/types/wimd";
import { NIMDMDataset } from "@/lib/types/nimdm";
import { LifeExpectancyDataset } from "@/lib/types/lifeExpectancy";
import { QualificationDataset } from "@/lib/types/qualification";
import { BroadbandDataset } from "@/lib/types/broadband";
import { AirQualityDataset } from "@/lib/types/airQuality";
import { ClaimantCountDataset } from "@/lib/types/claimantCount";
import { SchoolPerformanceDataset } from "@/lib/types/schoolPerformance";
import { NHSWaitingDataset } from "@/lib/types/nhsWaiting";
import { UnemploymentDataset } from "@/lib/types/unemployment";
import { ChildPovertyDataset } from "@/lib/types/childPoverty";
import { HomelessnessDataset } from "@/lib/types/homelessness";
import { FuelPovertyDataset } from "@/lib/types/fuelPoverty";
import type { BoundaryType } from "@/lib/types/boundaries";
import type { ChartDataset } from "@/lib/datasets/generated";
import { getChartDatasetDefinition } from "@/lib/datasets";
import { getPointsInBounds } from "@/lib/helpers/locationPoints";
import {
	getGenderColorExpression,
	getSequentialColorExpression,
} from "@/lib/helpers/colorScale/datasetColors";
import type { ColorRange } from "@/lib/types/common";
import { calculateMedianAge, calculateTotal } from "@/lib/helpers/population";

import type { MapManagerCallbacks } from "./callbacks";
export type { MapManagerCallbacks } from "./callbacks";

// Cache property detections to avoid repeated computation
const propCache = new Map<string, PropertyKeys>();

export class MapManager {
	private layerManager: LayerManager;
	private eventHandler: EventHandler;
	private statsCalculator: StatsCalculator;
	private featureBuilder: FeatureBuilder;
	private propertyDetector: PropertyDetector;
	private cache: StatsCache;
	private activeTransformedGeojson:
		| {
				boundary: BoundaryGeojson;
				dataset: object;
				mode: string;
				geojson: BoundaryGeojson;
			  }
		| undefined;
	private customRangeCache = new WeakMap<CustomDataset, ColorRange>();

	constructor(map: maplibregl.Map, callbacks: MapManagerCallbacks) {
		this.layerManager = new LayerManager(map);
		this.eventHandler = new EventHandler(map, callbacks);
		this.propertyDetector = new PropertyDetector();
		this.featureBuilder = new FeatureBuilder();
		this.cache = new StatsCache();
		this.statsCalculator = new StatsCalculator(
			this.propertyDetector,
			this.cache,
		);
	}

	// Unified election update method
	private updateElectionMap(
		geojson: BoundaryGeojson,
		dataset: LocalElectionDataset | GeneralElectionDataset,
		mapOptions: MapOptions,
		type: "localElection" | "generalElection",
		isDark = false,
	): void {
		const isLocal = type === "localElection";
		const options = isLocal
			? mapOptions.localElection
			: mapOptions.generalElection;

		// Cache property detection
		const cacheKey = `${type}-${geojson.features[0]?.properties ? Object.keys(geojson.features[0].properties).join(",") : ""}`;
		let codeProp = propCache.get(cacheKey);

		if (!codeProp) {
			codeProp = isLocal
				? this.propertyDetector.detectWardCode(geojson.features)
				: this.propertyDetector.detectConstituencyCode(
						geojson.features,
					);
			propCache.set(cacheKey, codeProp);
		}

		const mode = options.mode || "majority";
		const dataMap = isLocal
			? (dataset as LocalElectionDataset).data
			: (dataset as GeneralElectionDataset).data;
		const resultsMap = isLocal
			? (dataset as LocalElectionDataset).results
			: (dataset as GeneralElectionDataset).results;

		const excluded = new Set(options.excluded ?? []);
		const getWinner = excluded.size > 0
			? (code: string) => {
				const votes = dataMap[code]?.partyVotes;
				if (!votes) return "NONE";
				let best = "NONE";
				let bestVotes = -1;
				for (const [party, v] of Object.entries(votes)) {
					if (!excluded.has(party) && (v as number) > bestVotes) {
						bestVotes = v as number;
						best = party;
					}
				}
				return best;
			}
			: (code: string) => resultsMap[code] || "NONE";

		const sourceMode =
			mode === "percentage" && options.selected
				? `${type}:percentage:${options.selected}`
				: `${type}:majority:${[...excluded].sort().join(",")}`;
		const transformedGeojson = this.getActiveTransformedGeojson(
			geojson,
			dataset,
			sourceMode,
			() => {
				const features =
					mode === "percentage" && options.selected
						? this.featureBuilder.buildElectionPercentageFeatures(
								geojson.features,
								dataMap,
								options.selected,
								codeProp,
							)
						: this.featureBuilder.buildElectionWinnerFeatures(
								geojson.features,
								codeProp,
								getWinner,
							);
				return this.featureBuilder.formatBoundaryGeoJson(features);
			},
		);

		// Update layers
		if (mode === "percentage" && options.selected) {
			this.layerManager.updatePartyPercentageLayers(
				transformedGeojson,
				options,
				mapOptions.visibility,
				isDark,
			);
		} else {
			this.layerManager.updateElectionLayers(
				transformedGeojson,
				dataset.partyInfo,
				mapOptions.visibility,
			);
		}

		this.eventHandler.setupEventHandlers(dataMap, codeProp);
	}

	updateMapForLocalElection(
		geojson: BoundaryGeojson,
		dataset: LocalElectionDataset,
		mapOptions: MapOptions,
		isDark = false,
	): void {
		this.updateElectionMap(
			geojson,
			dataset,
			mapOptions,
			"localElection",
			isDark,
		);
	}

	updateMapForGeneralElection(
		geojson: BoundaryGeojson,
		dataset: GeneralElectionDataset,
		mapOptions: MapOptions,
		isDark = false,
	): void {
		this.updateElectionMap(
			geojson,
			dataset,
			mapOptions,
			"generalElection",
			isDark,
		);
	}

	updateMapForEthnicity(
		geojson: BoundaryGeojson,
		dataset: EthnicityDataset,
		mapOptions: MapOptions,
		isDark = false,
	): void {
		const cacheKey = `ethnicity-${geojson.features[0]?.properties ? Object.keys(geojson.features[0].properties).join(",") : ""}`;
		let codeProp = propCache.get(cacheKey);

		if (!codeProp) {
			codeProp = this.propertyDetector.detectLocalAuthorityCode(
				geojson.features,
			);
			propCache.set(cacheKey, codeProp);
		}

		const mode = mapOptions.ethnicity?.mode || "majority";

		// Build features based on mode
		const features = this.featureBuilder.buildEthnicityFeatures(
			geojson.features,
			dataset,
			codeProp,
			mapOptions,
		);

		const transformedGeojson =
			this.featureBuilder.formatBoundaryGeoJson(features);

		// Update layers based on mode
		if (mode === "percentage" && mapOptions.ethnicity?.selected) {
			this.layerManager.updateEthnicityCategoryPercentageLayers(
				transformedGeojson,
				mapOptions.ethnicity,
				mapOptions.visibility,
				isDark,
			);
		} else {
			this.layerManager.updateEthnicityMajorityLayers(
				transformedGeojson,
				mapOptions.visibility,
			);
		}

		this.eventHandler.setupEventHandlers(dataset.data, codeProp);
	}

	updateMapForCustomDataset(
		geojson: BoundaryGeojson,
		dataset: CustomDataset,
		mapOptions: MapOptions,
	): void {
		const cacheKey = `custom-${geojson.features[0]?.properties ? Object.keys(geojson.features[0].properties).join(",") : ""}`;
		let codeProp = propCache.get(cacheKey);

		if (!codeProp) {
			codeProp = this.propertyDetector.detectCode(geojson.features);
			propCache.set(cacheKey, codeProp);
		}

		const transformedGeojson = this.getValueGeojson(
			geojson,
			dataset,
			"custom-choropleth",
			codeProp,
			(code) => dataset.data[code] ?? null,
		);
		const range = this.getCustomRange(dataset);
		this.layerManager.updateValueLayers(
			transformedGeojson,
			range
				? getSequentialColorExpression(range, mapOptions.theme.id)
				: ["case", ["==", ["get", "value"], null], "#cccccc", "#cccccc"],
			mapOptions.visibility,
		);

		this.eventHandler.setupEventHandlers(dataset.data, codeProp);
	}

	private getCustomRange(dataset: CustomDataset): ColorRange | null {
		const cached = this.customRangeCache.get(dataset);
		if (cached) return cached;

		let min = Infinity;
		let max = -Infinity;
		for (const value of Object.values(dataset.data)) {
			if (value < min) min = value;
			if (value > max) max = value;
		}
		if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

		const range = { min, max };
		this.customRangeCache.set(dataset, range);
		return range;
	}

	// Renders a custom point dataset (coordinates / postcodes) as coloured
	// markers, independent of any boundary geometry.
	updateMapForCustomPoints(
		dataset: CustomDataset,
		mapOptions: MapOptions,
		bounds: [number, number, number, number] | null = null,
		isDark = false,
	): void {
		const excludedValues = new Set(
			mapOptions.custom.excludedPointValues ?? [],
		);
		const selectedValue = mapOptions.custom.selectedPointValue;
		const locationPoints = getPointsInBounds(dataset.points ?? [], bounds);
		const points = locationPoints.filter(
			(point) =>
				!excludedValues.has(point.value) &&
				(selectedValue === undefined || point.value === selectedValue),
		);
		if (points.length === 0) {
			this.layerManager.clearPointLayers();
			return;
		}

		let min = dataset.valueMin;
		let max = dataset.valueMax;
		if (min === undefined || max === undefined) {
			min = Infinity;
			max = -Infinity;
			for (const p of points) {
				if (p.value < min) min = p.value;
				if (p.value > max) max = p.value;
			}
		}

		const collection = this.featureBuilder.buildPointCollection(
			points,
			min,
			max,
			mapOptions.theme.id,
			dataset.pointStyle?.colorByValue,
		);
		// Add the point layers first, then blank the choropleth beneath. Doing it
		// in this order matters: clearBoundaryData() calls setData() on the boundary
		// source, which flips map.isStyleLoaded() to false until the worker re-parses.
		// updatePointLayers() bails early when the style isn't loaded, so blanking
		// first would drop the points entirely when switching from a boundary dataset
		// (the map would just clear). Refreshing straight into a point dataset hid the
		// bug because no boundary source existed yet.
		this.layerManager.updatePointLayers(
			collection,
			mapOptions.visibility,
			mapOptions.theme.id,
			dataset.pointStyle?.radius,
			dataset.pointStyle?.tooltip,
			isDark,
		);
		this.layerManager.clearBoundaryData();
	}

	clearCustomPoints(): void {
		this.layerManager.clearPointLayers();
	}

	// Unified population update method
	private updatePopulationMap(
		geojson: BoundaryGeojson,
		dataset: PopulationDataset,
		mapOptions: MapOptions,
		mode: "population-age" | "population-gender" | "population-density",
		valueFor: (code: string, feature: Features[number]) => number | null,
		colorExpression: (options: MapOptions) => unknown[],
	): void {
		const cacheKey = `population-${geojson.features[0]?.properties ? Object.keys(geojson.features[0].properties).join(",") : ""}`;
		let wardCodeProp = propCache.get(cacheKey);

		if (!wardCodeProp) {
			wardCodeProp = this.propertyDetector.detectWardCode(
				geojson.features,
			);
			propCache.set(cacheKey, wardCodeProp);
		}

		const transformedGeojson = this.getValueGeojson(
			geojson,
			dataset,
			mode,
			wardCodeProp,
			valueFor,
		);
		this.layerManager.updateValueLayers(
			transformedGeojson,
			colorExpression(mapOptions),
			mapOptions.visibility,
		);
		this.eventHandler.setupEventHandlers(dataset.data, wardCodeProp);
	}

	updateMapForAgeDistribution(
		geojson: BoundaryGeojson,
		dataset: PopulationDataset,
		mapOptions: MapOptions,
	): void {
		this.updatePopulationMap(
			geojson,
			dataset,
			mapOptions,
			"population-age",
			(code) => {
				const ward = dataset.data[code];
				return ward ? calculateMedianAge(ward) ?? 0 : null;
			},
			(options) =>
				getSequentialColorExpression(
					options.ageDistribution.colorRange,
					options.theme.id,
				),
		);
	}

	updateMapForGender(
		geojson: BoundaryGeojson,
		dataset: PopulationDataset,
		mapOptions: MapOptions,
	): void {
		this.updatePopulationMap(
			geojson,
			dataset,
			mapOptions,
			"population-gender",
			(code) => {
				const ward = dataset.data[code];
				if (!ward) return null;
				const males = calculateTotal(ward.males);
				const females = calculateTotal(ward.females);
				return females > 0 ? (males - females) / females : 0;
			},
			(options) => getGenderColorExpression(options.gender.colorRange),
		);
	}

	updateMapForPopulationDensity(
		geojson: BoundaryGeojson,
		dataset: PopulationDataset,
		mapOptions: MapOptions,
	): void {
		this.updatePopulationMap(
			geojson,
			dataset,
			mapOptions,
			"population-density",
			(code, feature) => {
				const ward = dataset.data[code];
				if (!ward) return null;
				const total = calculateTotal(ward.males) + calculateTotal(ward.females);
				const area = this.featureBuilder.getFeatureAreaSqKm(feature);
				return area > 0 ? total / area : 0;
			},
			(options) =>
				getSequentialColorExpression(
					options.populationDensity.colorRange,
					options.theme.id,
				),
		);
	}

	// Generic update method for simple datasets
	private detectBoundaryProperty(
		features: Features,
		boundaryType: BoundaryType,
	): PropertyKeys {
		switch (boundaryType) {
			case "ward": return this.propertyDetector.detectWardCode(features);
			case "constituency": return this.propertyDetector.detectConstituencyCode(features);
			case "localAuthority": return this.propertyDetector.detectLocalAuthorityCode(features);
			case "lsoa": return this.propertyDetector.detectLSOACode(features);
			case "dataZone": return this.propertyDetector.detectDataZoneCode(features);
			case "superOutputArea": return this.propertyDetector.detectSOACode(features);
		}
	}

	private updateGenericMap<T extends { data: Record<string, unknown> }>(
		geojson: BoundaryGeojson,
		dataset: T,
		mapOptions: MapOptions,
		detectProperty: (features: Features) => PropertyKeys,
		eventType: MapMode,
		dataForEvents: Record<string, unknown>,
		valueFor: (dataset: T, code: string) => number | null | undefined,
		getColorRange: (dataset: T, options: MapOptions) => ColorRange,
		invertColor = true,
	): void {
		const cacheKey = `${eventType}-${geojson.features[0]?.properties ? Object.keys(geojson.features[0].properties).join(",") : ""}`;
		let codeProp: PropertyKeys | undefined = propCache.get(cacheKey);

		if (!codeProp) {
			codeProp = detectProperty(geojson.features);
			propCache.set(cacheKey, codeProp);
		}

		if (!codeProp) {
			console.warn("codeProp is undefined, skipping feature building.");
			return;
		}

		const transformedGeojson = this.getValueGeojson(
			geojson,
			dataset,
			eventType,
			codeProp,
			(code) => valueFor(dataset, code),
		);
		this.layerManager.updateValueLayers(
			transformedGeojson,
			getSequentialColorExpression(
				getColorRange(dataset, mapOptions),
				mapOptions.theme.id,
				invertColor,
			),
			mapOptions.visibility,
		);
		this.eventHandler.setupEventHandlers(dataForEvents, codeProp);
	}

	updateMapForScalarDataset(
		geojson: BoundaryGeojson,
		dataset: ChartDataset,
		mapOptions: MapOptions,
	): void {
		const definition = getChartDatasetDefinition(dataset.type);
		if (!definition?.map) return;
		const map = definition.map;

		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			(features) => this.detectBoundaryProperty(features, dataset.boundaryType),
			dataset.type,
			dataset.data,
			(data, code) => {
				const mappedValue = map.valueFor?.(data, code);
				if (mappedValue !== undefined) return mappedValue;
				const value = map.valueKey
					? (data.data[code] as unknown as Record<string, unknown> | undefined)?.[map.valueKey]
					: null;
				return typeof value === "number" && Number.isFinite(value) ? value : null;
			},
			(_, options) => options[dataset.type].colorRange,
		);
	}

	private getValueGeojson<T extends object>(
		geojson: BoundaryGeojson,
		dataset: T,
		mode: string,
		codeProp: PropertyKeys,
		valueFor: (code: string, feature: Features[number]) => number | null | undefined,
	): BoundaryGeojson {
		return this.getActiveTransformedGeojson(
			geojson,
			dataset,
			mode,
			() =>
				this.featureBuilder.formatBoundaryGeoJson(
					this.featureBuilder.buildValueFeatures(
						geojson.features,
						codeProp,
						valueFor,
					),
				),
		);
	}

	private getActiveTransformedGeojson<T extends object>(
		boundary: BoundaryGeojson,
		dataset: T,
		mode: string,
		build: () => BoundaryGeojson,
	): BoundaryGeojson {
		const cached = this.activeTransformedGeojson;
		if (
			cached?.boundary === boundary &&
			cached.dataset === dataset &&
			cached.mode === mode
		) {
			return cached.geojson;
		}

		const transformed = build();
		this.activeTransformedGeojson = {
			boundary,
			dataset,
			mode,
			geojson: transformed,
		};
		return transformed;
	}

	updateMapForHousePrices(
		geojson: BoundaryGeojson,
		dataset: HousePriceDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectWardCode.bind(this.propertyDetector),
			"housePrice",
			dataset.data,
			(data, code) => data.data[code]?.prices[2023] || null,
			(_, options) => options.housePrice.colorRange,
		);
	}

	updateMapForCrimeRate(
		geojson: BoundaryGeojson,
		dataset: CrimeDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectLocalAuthorityCode.bind(
				this.propertyDetector,
			),
			"crime",
			dataset.data,
			(data, code) => data.data[code]?.totalRecordedCrime ?? null,
			(_, options) => options.crime.colorRange,
		);
	}

	updateMapForIncome(
		geojson: BoundaryGeojson,
		dataset: IncomeDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectLocalAuthorityCode.bind(
				this.propertyDetector,
			),
			"income",
			dataset.data,
			(data, code) => data.data[code]?.annual?.median || null,
			(_, options) => options.income.colorRange,
		);
	}

	updateMapForBrexit(
		geojson: BoundaryGeojson,
		dataset: BrexitLADDataset,
		mapOptions: MapOptions,
	): void {
		const cacheKey = `brexit-${geojson.features[0]?.properties ? Object.keys(geojson.features[0].properties).join(",") : ""}`;
		let codeProp = propCache.get(cacheKey);

		if (!codeProp) {
			codeProp = this.propertyDetector.detectLocalAuthorityCode(
				geojson.features,
			);
			propCache.set(cacheKey, codeProp);
		}

		const features = this.featureBuilder.buildBrexitFeatures(
			geojson.features,
			dataset,
			codeProp,
			mapOptions,
		);

		const transformedGeojson =
			this.featureBuilder.formatBoundaryGeoJson(features);

		this.layerManager.updateColoredLayers(
			transformedGeojson,
			mapOptions.visibility,
		);
		this.eventHandler.setupEventHandlers(dataset.data, codeProp);
	}

	updateMapForBrexitConstituency(
		geojson: BoundaryGeojson,
		dataset: BrexitConstituencyDataset,
		mapOptions: MapOptions,
	): void {
		const cacheKey = `brexitConstituency-${geojson.features[0]?.properties ? Object.keys(geojson.features[0].properties).join(",") : ""}`;
		let codeProp = propCache.get(cacheKey);

		if (!codeProp) {
			codeProp = this.propertyDetector.detectConstituencyCode(
				geojson.features,
			);
			propCache.set(cacheKey, codeProp);
		}

		const features = this.featureBuilder.buildBrexitConstituencyFeatures(
			geojson.features,
			dataset,
			codeProp,
			mapOptions,
		);
		const transformedGeojson =
			this.featureBuilder.formatBoundaryGeoJson(features);

		this.layerManager.updateColoredLayers(
			transformedGeojson,
			mapOptions.visibility,
		);
		this.eventHandler.setupEventHandlers(dataset.data, codeProp);
	}

	calculateBrexitConstituencyStats(
		geojson: BoundaryGeojson,
		constituencyData: BrexitConstituencyDataset["data"],
		location: string | null,
		datasetId: string | null,
	) {
		return this.statsCalculator.calculateBrexitConstituencyStats(
			geojson,
			constituencyData,
			location,
			datasetId,
		);
	}

	calculateLocalElectionStats(
		geojson: BoundaryGeojson,
		wardData: LocalElectionDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateLocalElectionStats(
			geojson,
			wardData,
			location,
			datasetId,
		);
	}

	calculateGeneralElectionStats(
		geojson: BoundaryGeojson,
		constituencyData: GeneralElectionDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateGeneralElectionStats(
			geojson,
			constituencyData,
			location,
			datasetId,
		);
	}

	calculatePopulationStats(
		geojson: BoundaryGeojson,
		populationData: PopulationDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculatePopulationStats(
			geojson,
			populationData,
			location,
			datasetId,
		);
	}

	calculateEthnicityStats(
		geojson: BoundaryGeojson,
		ethnicityData: EthnicityDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateEthnicityStats(
			geojson,
			ethnicityData,
			location,
			datasetId,
		);
	}

	calculateHousePriceStats(
		geojson: BoundaryGeojson,
		wardData: HousePriceDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateHousePriceStats(
			geojson,
			wardData,
			location,
			datasetId,
		);
	}

	calculateCrimeStats(
		geojson: BoundaryGeojson,
		wardData: CrimeDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateCrimeStats(
			geojson,
			wardData,
			location,
			datasetId,
		);
	}

	calculateIncomeStats(
		geojson: BoundaryGeojson,
		localAuthorityData: IncomeDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateIncomeStats(
			geojson,
			localAuthorityData,
			location,
			datasetId,
		);
	}

	calculateBrexitStats(
		geojson: BoundaryGeojson,
		brexitData: BrexitLADDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateBrexitStats(
			geojson,
			brexitData,
			location,
			datasetId,
		);
	}

	calculateCustomDatasetStats(
		geojson: BoundaryGeojson,
		data: CustomDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateCustomDatasetStats(
			geojson,
			data,
			location,
			datasetId,
		);
	}

	updateMapForIMD(
		geojson: BoundaryGeojson,
		dataset: IMDDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectLSOACode.bind(this.propertyDetector),
			"imd",
			dataset.data,
			(data, code) => data.data[code]?.imdScore ?? null,
			(_, options) => options.imd.colorRange,
		);
	}

	calculateIMDStats(
		geojson: BoundaryGeojson,
		data: IMDDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateIMDStats(
			geojson,
			data,
			location,
			datasetId,
		);
	}

	updateMapForSIMD(
		geojson: BoundaryGeojson,
		dataset: SIMDDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectDataZoneCode.bind(
				this.propertyDetector,
			),
			"simd",
			dataset.data,
			(data, code) => data.data[code]?.simdRank ?? null,
			(_, options) => options.simd.colorRange,
			false,
		);
	}

	calculateSIMDStats(
		geojson: BoundaryGeojson,
		data: SIMDDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateSIMDStats(
			geojson,
			data,
			location,
			datasetId,
		);
	}

	updateMapForWIMD(
		geojson: BoundaryGeojson,
		dataset: WIMDDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectLSOACode.bind(this.propertyDetector),
			"wimd",
			dataset.data,
			(data, code) => data.data[code]?.wimdRank ?? null,
			(_, options) => options.wimd.colorRange,
			false,
		);
	}

	calculateWIMDStats(
		geojson: BoundaryGeojson,
		data: WIMDDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateWIMDStats(
			geojson,
			data,
			location,
			datasetId,
		);
	}

	updateMapForNIMDM(
		geojson: BoundaryGeojson,
		dataset: NIMDMDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectSOACode.bind(this.propertyDetector),
			"nimdm",
			dataset.data,
			(data, code) => data.data[code]?.nimdmRank ?? null,
			(_, options) => options.nimdm.colorRange,
			false,
		);
	}

	calculateNIMDMStats(
		geojson: BoundaryGeojson,
		data: NIMDMDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateNIMDMStats(
			geojson,
			data,
			location,
			datasetId,
		);
	}

	updateMapForLifeExpectancy(
		geojson: BoundaryGeojson,
		dataset: LifeExpectancyDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectLocalAuthorityCode.bind(
				this.propertyDetector,
			),
			"lifeExpectancy",
			dataset.data,
			(data, code) => {
				const area = data.data[code];
				return area ? (area.maleBirthLE + area.femaleBirthLE) / 2 : null;
			},
			(data) => {
				let min = Infinity;
				let max = -Infinity;
				for (const area of Object.values(data.data)) {
					const value = (area.maleBirthLE + area.femaleBirthLE) / 2;
					min = Math.min(min, value);
					max = Math.max(max, value);
				}
				return { min, max };
			},
			false,
		);
	}

	calculateLifeExpectancyStats(
		geojson: BoundaryGeojson,
		data: LifeExpectancyDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateLifeExpectancyStats(
			geojson,
			data,
			location,
			datasetId,
		);
	}

	updateMapForQualification(
		geojson: BoundaryGeojson,
		dataset: QualificationDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectLocalAuthorityCode.bind(
				this.propertyDetector,
			),
			"qualification",
			dataset.data,
			(data, code) => {
				const area = data.data[code];
				return area && area.breakdown.total > 0
					? (area.breakdown.level4Plus / area.breakdown.total) * 100
					: null;
			},
			(_, options) => options.qualification.colorRange,
		);
	}

	calculateQualificationStats(
		geojson: BoundaryGeojson,
		data: QualificationDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateQualificationStats(
			geojson,
			data,
			location,
			datasetId,
		);
	}

	updateMapForBroadband(
		geojson: BoundaryGeojson,
		dataset: BroadbandDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectLocalAuthorityCode.bind(this.propertyDetector),
			"broadband",
			dataset.data,
			(data, code) => data.data[code]?.pctFullFibre ?? null,
			(_, options) => options.broadband.colorRange,
		);
	}

	calculateBroadbandStats(
		geojson: BoundaryGeojson,
		data: BroadbandDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateBroadbandStats(geojson, data, location, datasetId);
	}

	updateMapForAirQuality(
		geojson: BoundaryGeojson,
		dataset: AirQualityDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectLocalAuthorityCode.bind(this.propertyDetector),
			"airQuality",
			dataset.data,
			(data, code) => data.data[code]?.no2Mean ?? null,
			(_, options) => options.airQuality.colorRange,
		);
	}

	calculateAirQualityStats(
		geojson: BoundaryGeojson,
		data: AirQualityDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateAirQualityStats(geojson, data, location, datasetId);
	}

	updateMapForClaimantCount(
		geojson: BoundaryGeojson,
		dataset: ClaimantCountDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectLocalAuthorityCode.bind(this.propertyDetector),
			"claimantCount",
			dataset.data,
			(data, code) => data.data[code]?.totalRate ?? null,
			(_, options) => options.claimantCount.colorRange,
		);
	}

	calculateClaimantCountStats(
		geojson: BoundaryGeojson,
		data: ClaimantCountDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateClaimantCountStats(geojson, data, location, datasetId);
	}

	updateMapForSchoolPerformance(
		geojson: BoundaryGeojson,
		dataset: SchoolPerformanceDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectLocalAuthorityCode.bind(this.propertyDetector),
			"schoolPerformance",
			dataset.data,
			(data, code) => data.data[code]?.ptL2basics94 ?? null,
			(_, options) => options.schoolPerformance.colorRange,
		);
	}

	updateMapForNHSWaiting(
		geojson: BoundaryGeojson,
		dataset: NHSWaitingDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectLocalAuthorityCode.bind(this.propertyDetector),
			"nhsWaiting",
			dataset.data,
			(data, code) => {
				const icbCode = data.ladToIcb[code];
				return icbCode ? data.data[icbCode]?.pctOver18Weeks ?? null : null;
			},
			(_, options) => options.nhsWaiting.colorRange,
		);
	}

	calculateSchoolPerformanceStats(
		geojson: BoundaryGeojson,
		data: SchoolPerformanceDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateSchoolPerformanceStats(geojson, data, location, datasetId);
	}

	calculateNHSWaitingStats(
		geojson: BoundaryGeojson,
		dataset: NHSWaitingDataset,
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateNHSWaitingStats(geojson, dataset, location, datasetId);
	}

	updateMapForUnemployment(
		geojson: BoundaryGeojson,
		dataset: UnemploymentDataset,
		mapOptions: MapOptions,
	): void {
		this.updateGenericMap(
			geojson,
			dataset,
			mapOptions,
			this.propertyDetector.detectLocalAuthorityCode.bind(this.propertyDetector),
			"unemployment",
			dataset.data,
			(data, code) => data.data[code]?.rates[data.latestYear] ?? null,
			(_, options) => options.unemployment.colorRange,
		);
	}

	calculateUnemploymentStats(
		geojson: BoundaryGeojson,
		dataset: UnemploymentDataset,
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateUnemploymentStats(geojson, dataset, location, datasetId);
	}

	calculateChildPovertyStats(
		geojson: BoundaryGeojson,
		data: ChildPovertyDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateChildPovertyStats(geojson, data, location, datasetId);
	}

	calculateHomelessnessStats(
		geojson: BoundaryGeojson,
		data: HomelessnessDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateHomelessnessStats(geojson, data, location, datasetId);
	}

	calculateFuelPovertyStats(
		geojson: BoundaryGeojson,
		data: FuelPovertyDataset["data"],
		location: string | null = null,
		datasetId: string | null = null,
	) {
		return this.statsCalculator.calculateFuelPovertyStats(geojson, data, location, datasetId);
	}

	setBorderVisibility(hidden: boolean): void {
		this.layerManager.setBorderVisibility(hidden);
	}

	updateVisibility(visibility: MapOptions["visibility"]): void {
		this.layerManager.updateVisibility(visibility);
	}

	destroy(): void {
		this.eventHandler.destroy();
		propCache.clear(); // Clean up cache on destroy
		this.activeTransformedGeojson = undefined;
		this.customRangeCache = new WeakMap<CustomDataset, ColorRange>();
	}
}
