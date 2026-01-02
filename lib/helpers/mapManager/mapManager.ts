// lib/utils/mapManager/mapManager.ts
import {
	BoundaryGeojson,
	LocalElectionDataset,
	GeneralElectionDataset,
	PopulationDataset,
	HousePriceDataset,
	CrimeDataset,
	SelectedArea,
	EthnicityDataset,
	PropertyKeys,
	CustomDataset,
} from "@lib/types";
import { MapMode, MapOptions } from "@lib/types/mapOptions";
import { LayerManager } from "./layerManager";
import { EventHandler } from "./eventHandler";
import { StatsCalculator } from "./statsCalculator";
import { FeatureBuilder } from "./featureBuilder";
import { PropertyDetector } from "./propertyDetector";
import { StatsCache } from "./statsCache";
import { IncomeDataset } from "@/lib/types/income";

export interface MapManagerCallbacks {
	onAreaHover?: (location: SelectedArea | null) => void;
	onLocationChange: (location: string) => void;
}

// Cache property detections to avoid repeated computation
const propCache = new Map<string, PropertyKeys>();

export class MapManager {
	private layerManager: LayerManager;
	private eventHandler: EventHandler;
	private statsCalculator: StatsCalculator;
	private featureBuilder: FeatureBuilder;
	private propertyDetector: PropertyDetector;
	private cache: StatsCache;

	constructor(
		map: mapboxgl.Map | maplibregl.Map,
		callbacks: MapManagerCallbacks,
	) {
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

		// Build features once
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
					(code) => resultsMap[code] || "NONE",
				);

		const transformedGeojson =
			this.featureBuilder.formatBoundaryGeoJson(features);

		// Update layers
		if (mode === "percentage" && options.selected) {
			this.layerManager.updatePartyPercentageLayers(
				transformedGeojson,
				options,
				mapOptions.visibility,
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
	): void {
		this.updateElectionMap(geojson, dataset, mapOptions, "localElection");
	}

	updateMapForGeneralElection(
		geojson: BoundaryGeojson,
		dataset: GeneralElectionDataset,
		mapOptions: MapOptions,
	): void {
		this.updateElectionMap(geojson, dataset, mapOptions, "generalElection");
	}

	updateMapForEthnicity(
		geojson: BoundaryGeojson,
		dataset: EthnicityDataset,
		mapOptions: MapOptions,
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
			);
		} else {
			this.layerManager.updateEthnicityMajorityLayers(
				transformedGeojson,
				mapOptions.visibility,
			);
		}

		this.eventHandler.setupEventHandlers(
			dataset.data,
			codeProp,
		);
	}

	updateMapForCustomDataset(
		geojson: BoundaryGeojson,
		dataset: any,
		mapOptions: MapOptions,
	): void {
		const cacheKey = `custom-${geojson.features[0]?.properties ? Object.keys(geojson.features[0].properties).join(",") : ""}`;
		let codeProp = propCache.get(cacheKey);

		if (!codeProp) {
			codeProp = this.propertyDetector.detectCode(geojson.features);
			propCache.set(cacheKey, codeProp);
		}

		const features = this.featureBuilder.buildCustomDatasetFeatures(
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

		this.eventHandler.setupEventHandlers(
			dataset.data,
			codeProp,
		);
	}

	// Unified population update method
	private updatePopulationMap(
		geojson: BoundaryGeojson,
		dataset: PopulationDataset,
		mapOptions: MapOptions,
		buildFeatures: (
			features: any[],
			dataset: PopulationDataset,
			codeProp: PropertyKeys,
			options: MapOptions,
		) => any[],
	): void {
		const cacheKey = `population-${geojson.features[0]?.properties ? Object.keys(geojson.features[0].properties).join(",") : ""}`;
		let wardCodeProp = propCache.get(cacheKey);

		if (!wardCodeProp) {
			wardCodeProp = this.propertyDetector.detectWardCode(
				geojson.features,
			);
			propCache.set(cacheKey, wardCodeProp);
		}

		const features = buildFeatures(
			geojson.features,
			dataset,
			wardCodeProp,
			mapOptions,
		);
		const transformedGeojson =
			this.featureBuilder.formatBoundaryGeoJson(features);

		this.layerManager.updateColoredLayers(
			transformedGeojson,
			mapOptions.visibility,
		);
		this.eventHandler.setupEventHandlers(
			dataset.data,
			wardCodeProp,
		);
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
			this.featureBuilder.buildAgeFeatures.bind(this.featureBuilder),
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
			this.featureBuilder.buildGenderFeatures.bind(this.featureBuilder),
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
			this.featureBuilder.buildDensityFeatures.bind(this.featureBuilder),
		);
	}

	// Generic update method for simple datasets
	private updateGenericMap(
		geojson: BoundaryGeojson,
		dataset: any,
		mapOptions: MapOptions,
		detectProperty: (features: any[]) => PropertyKeys, // Ensure detectProperty returns PropertyKeys
		buildFeatures: (
			features: any[],
			dataset: any,
			codeProp: PropertyKeys, // Changed to PropertyKeys
			options: MapOptions,
		) => any[],
		eventType: MapMode,
		dataForEvents: any,
	): void {
		const cacheKey = `${eventType}-${geojson.features[0]?.properties ? Object.keys(geojson.features[0].properties).join(",") : ""}`;
		let codeProp: PropertyKeys | undefined = propCache.get(cacheKey); // Changed to PropertyKeys | undefined

		if (!codeProp) {
			codeProp = detectProperty(geojson.features);
			propCache.set(cacheKey, codeProp);
		}

		if (!codeProp) {
			console.warn("codeProp is undefined, skipping feature building.");
			return;
		}

		const features = buildFeatures(
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
		this.eventHandler.setupEventHandlers(
			dataForEvents,
			codeProp as string, // Cast to string for eventHandler
		);
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
			this.propertyDetector.detectWardCode.bind(this.propertyDetector) as (features: any[]) => PropertyKeys,
			this.featureBuilder.buildHousePriceFeatures.bind(
				this.featureBuilder,
			),
			"housePrice",
			dataset.data,
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
			) as (features: any[]) => PropertyKeys,
			this.featureBuilder.buildCrimeRateFeatures.bind(
				this.featureBuilder,
			),
			"crime",
			dataset.data,
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
			) as (features: any[]) => PropertyKeys,
			this.featureBuilder.buildIncomeFeatures.bind(this.featureBuilder),
			"income",
			dataset.data,
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

	destroy(): void {
		this.eventHandler.destroy();
		propCache.clear(); // Clean up cache on destroy
	}
}
