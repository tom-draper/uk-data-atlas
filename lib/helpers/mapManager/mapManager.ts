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
import type { Map as MapLibreMap } from "maplibre-gl";
import { LayerManager } from "./layerManager";
import { EventHandler } from "./eventHandler";
import { DatasetAggregator } from "../datasetAggregation";
import { FeatureBuilder } from "./featureBuilder";
import { PropertyDetector } from "./propertyDetector";
import { StatsCache } from "./statsCache";
import type { BoundaryType } from "@/lib/types/boundaries";
import { getPointsInBounds } from "@/lib/helpers/locationPoints";
import {
	getGenderColorExpression,
	getSequentialColorExpression,
} from "@/lib/helpers/colorScale/datasetColors";
import type { ColorRange } from "@/lib/types/common";
import { calculateMedianAge, calculateTotal } from "@/lib/helpers/population";
import { nullFallback, type MapExpression } from "./expressions";
import type { VectorLineLayer } from "./layers";

import type { MapManagerCallbacks } from "./callbacks";
export type { MapManagerCallbacks } from "./callbacks";

// Cache property detections to avoid repeated computation
const propCache = new Map<string, PropertyKeys>();

type NumericDataset = {
	type: MapMode;
	boundaryType: BoundaryType;
	data: Record<string, unknown>;
};

export interface NumericMapConfig<T extends NumericDataset> {
	valueKey?: string;
	valueFor?(dataset: T, code: string): number | null;
	invertColor?: boolean;
	getColorRange?(dataset: T): ColorRange;
}

export class MapManager {
	private layerManager: LayerManager;
	private eventHandler: EventHandler;
	readonly datasetAggregator: DatasetAggregator;
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

	constructor(map: MapLibreMap, callbacks: MapManagerCallbacks) {
		this.layerManager = new LayerManager(map);
		this.eventHandler = new EventHandler(map, callbacks);
		this.propertyDetector = new PropertyDetector();
		this.featureBuilder = new FeatureBuilder();
		this.cache = new StatsCache();
		this.datasetAggregator = new DatasetAggregator(
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
		this.layerManager.render({
			kind: "boundary-fill",
			data: transformedGeojson,
			colorExpression: range
				? getSequentialColorExpression(range, mapOptions.theme.id)
				: nullFallback("value", "#cccccc", "#cccccc"),
			visibility: mapOptions.visibility,
		});

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
		// the point renderer bails early when the style isn't loaded, so blanking
		// first would drop the points entirely when switching from a boundary dataset
		// (the map would just clear). Refreshing straight into a point dataset hid the
		// bug because no boundary source existed yet.
		this.layerManager.render({
			kind: "points",
			data: collection,
			visibility: mapOptions.visibility,
			radius: dataset.pointStyle?.radius,
			tooltip: dataset.pointStyle?.tooltip,
			isDark,
		});
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
		colorExpression: (options: MapOptions) => MapExpression,
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
		this.layerManager.render({
			kind: "boundary-fill",
			data: transformedGeojson,
			colorExpression: colorExpression(mapOptions),
			visibility: mapOptions.visibility,
		});
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
		this.layerManager.render({
			kind: "boundary-fill",
			data: transformedGeojson,
			colorExpression: getSequentialColorExpression(
				getColorRange(dataset, mapOptions),
				mapOptions.theme.id,
				invertColor,
			),
			visibility: mapOptions.visibility,
		});
		this.eventHandler.setupEventHandlers(dataForEvents, codeProp);
	}

	updateMapForNumericDataset<T extends NumericDataset>(
		geojson: BoundaryGeojson,
		dataset: T,
		mapOptions: MapOptions,
		map: NumericMapConfig<T>,
	): void {
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
			(data, options) => map.getColorRange?.(data) ?? (options[dataset.type] as { colorRange: ColorRange }).colorRange,
			map.invertColor,
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

	setBorderVisibility(hidden: boolean): void {
		this.layerManager.setBorderVisibility(hidden);
	}

	updateVisibility(visibility: MapOptions["visibility"]): void {
		this.layerManager.updateVisibility(visibility);
	}

	updateVectorLineLayer(layer: VectorLineLayer): void {
		this.layerManager.render(layer);
		this.clearMapDataLayers();
	}

	clearMapDataLayers(): void {
		// A network is a map-native dataset, not an overlay on the previously
		// selected choropleth or point dataset. Render first because clearing the
		// boundary source can briefly make the style unavailable.
		this.layerManager.clearBoundaryData();
		this.layerManager.clearPointLayers();
	}

	clearVectorLineLayer(id: string): void {
		this.layerManager.clearLineLayer(id, true);
	}

	countRenderedFeaturesByProperty(
		id: string,
		property: string,
	): Record<string, number> | null {
		return this.layerManager.countRenderedFeaturesByProperty(id, property);
	}

	onIdle(callback: () => void): () => void {
		return this.layerManager.onIdle(callback);
	}

	destroy(): void {
		this.eventHandler.destroy();
		propCache.clear(); // Clean up cache on destroy
		this.activeTransformedGeojson = undefined;
		this.customRangeCache = new WeakMap<CustomDataset, ColorRange>();
	}
}
