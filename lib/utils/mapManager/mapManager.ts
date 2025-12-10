// lib/utils/mapManager/mapManager.ts
import { BoundaryGeojson, LocalElectionDataset, GeneralElectionDataset, PopulationDataset, HousePriceDataset, CrimeDataset, BoundaryType } from '@lib/types';
import { MapOptions } from '@lib/types/mapOptions';
import { LayerManager } from './layerManager';
import { EventHandler } from './eventHandler';
import { StatsCalculator } from './statsCalculator';
import { FeatureBuilder } from './featureBuilder';
import { PropertyDetector } from './propertyDetector';
import { StatsCache } from './statsCache';
import { IncomeDataset } from '@/lib/types/income';

export interface LocationHoverData {
    type: BoundaryType;
    code: string;
    data: any;
}

export interface MapManagerCallbacks {
    onLocationHover?: (location: LocationHoverData | null) => void;
    onLocationChange: (location: string) => void;
}

export type MapMode = 'localElection' | 'generalElection' | 'population' | 'housePrice' | 'crime' | 'income';

// Cache property detections to avoid repeated computation
const propCache = new Map<string, string>();

export class MapManager {
    private layerManager: LayerManager;
    private eventHandler: EventHandler;
    private statsCalculator: StatsCalculator;
    private featureBuilder: FeatureBuilder;
    private propertyDetector: PropertyDetector;
    private cache: StatsCache;

    constructor(map: mapboxgl.Map | maplibregl.Map, callbacks: MapManagerCallbacks) {
        this.layerManager = new LayerManager(map);
        this.eventHandler = new EventHandler(map, callbacks);
        this.propertyDetector = new PropertyDetector();
        this.featureBuilder = new FeatureBuilder();
        this.cache = new StatsCache();
        this.statsCalculator = new StatsCalculator(this.propertyDetector, this.cache);
    }

    // Unified election update method
    private updateElectionMap(
        geojson: BoundaryGeojson,
        dataset: LocalElectionDataset | GeneralElectionDataset,
        mapOptions: MapOptions,
        type: 'localElection' | 'generalElection'
    ): void {
        const isLocal = type === 'localElection';
        const options = isLocal ? mapOptions.localElection : mapOptions.generalElection;
        
        // Cache property detection
        const cacheKey = `${type}-${geojson.features[0]?.properties ? Object.keys(geojson.features[0].properties).join(',') : ''}`;
        let codeProp = propCache.get(cacheKey);
        
        if (!codeProp) {
            codeProp = isLocal 
                ? this.propertyDetector.detectWardCode(geojson.features)
                : this.propertyDetector.detectConstituencyCode(geojson.features);
            propCache.set(cacheKey, codeProp);
        }

        const mode = options.mode || 'winner';
        const dataMap = isLocal 
            ? (dataset as LocalElectionDataset).wardData 
            : (dataset as GeneralElectionDataset).constituencyData;
        const resultsMap = isLocal
            ? (dataset as LocalElectionDataset).wardResults
            : (dataset as GeneralElectionDataset).constituencyResults;

        // Build features once
        const features = mode === 'party-percentage' && options.selectedParty
            ? this.featureBuilder.buildPartyPercentageFeatures(geojson.features, dataMap, options.selectedParty, codeProp)
            : this.featureBuilder.buildWinnerFeatures(geojson.features, codeProp, (code) => resultsMap[code] || 'NONE');

        const transformedGeojson = this.featureBuilder.formatBoundaryGeoJson(features);

        // Update layers
        if (mode === 'party-percentage' && options.selectedParty) {
            this.layerManager.updatePartyPercentageLayers(transformedGeojson, options);
        } else {
            this.layerManager.updateElectionLayers(transformedGeojson, dataset.partyInfo);
        }

        this.eventHandler.setupEventHandlers(type, dataMap, codeProp);
    }

    updateMapForLocalElection(geojson: BoundaryGeojson, dataset: LocalElectionDataset, mapOptions: MapOptions): void {
        this.updateElectionMap(geojson, dataset, mapOptions, 'localElection');
    }

    updateMapForGeneralElection(geojson: BoundaryGeojson, dataset: GeneralElectionDataset, mapOptions: MapOptions): void {
        this.updateElectionMap(geojson, dataset, mapOptions, 'generalElection');
    }

    // Unified population update method
    private updatePopulationMap(
        geojson: BoundaryGeojson,
        dataset: PopulationDataset,
        mapOptions: MapOptions,
        buildFeatures: (features: any[], dataset: PopulationDataset, codeProp: string, options: MapOptions) => any[]
    ): void {
        const cacheKey = `population-${geojson.features[0]?.properties ? Object.keys(geojson.features[0].properties).join(',') : ''}`;
        let wardCodeProp = propCache.get(cacheKey);
        
        if (!wardCodeProp) {
            wardCodeProp = this.propertyDetector.detectWardCode(geojson.features);
            propCache.set(cacheKey, wardCodeProp);
        }

        const features = buildFeatures(geojson.features, dataset, wardCodeProp, mapOptions);
        const transformedGeojson = this.featureBuilder.formatBoundaryGeoJson(features);

        this.layerManager.updateColoredLayers(transformedGeojson);
        this.eventHandler.setupEventHandlers('population', dataset.populationData, wardCodeProp);
    }

    updateMapForAgeDistribution(geojson: BoundaryGeojson, dataset: PopulationDataset, mapOptions: MapOptions): void {
        this.updatePopulationMap(geojson, dataset, mapOptions, this.featureBuilder.buildAgeFeatures.bind(this.featureBuilder));
    }

    updateMapForGender(geojson: BoundaryGeojson, dataset: PopulationDataset, mapOptions: MapOptions): void {
        this.updatePopulationMap(geojson, dataset, mapOptions, this.featureBuilder.buildGenderFeatures.bind(this.featureBuilder));
    }

    updateMapForPopulationDensity(geojson: BoundaryGeojson, dataset: PopulationDataset, mapOptions: MapOptions): void {
        this.updatePopulationMap(geojson, dataset, mapOptions, this.featureBuilder.buildDensityFeatures.bind(this.featureBuilder));
    }

    // Generic update method for simple datasets
    private updateGenericMap(
        geojson: BoundaryGeojson,
        dataset: any,
        mapOptions: MapOptions,
        detectProperty: (features: any[]) => string,
        buildFeatures: (features: any[], dataset: any, codeProp: string, options: MapOptions) => any[],
        eventType: MapMode,
        dataForEvents: any
    ): void {
        const cacheKey = `${eventType}-${geojson.features[0]?.properties ? Object.keys(geojson.features[0].properties).join(',') : ''}`;
        let codeProp = propCache.get(cacheKey);
        
        if (!codeProp) {
            codeProp = detectProperty(geojson.features);
            propCache.set(cacheKey, codeProp);
        }

        const features = buildFeatures(geojson.features, dataset, codeProp, mapOptions);
        const transformedGeojson = this.featureBuilder.formatBoundaryGeoJson(features);

        this.layerManager.updateColoredLayers(transformedGeojson);
        this.eventHandler.setupEventHandlers(eventType, dataForEvents, codeProp);
    }

    updateMapForHousePrices(geojson: BoundaryGeojson, dataset: HousePriceDataset, mapOptions: MapOptions): void {
        this.updateGenericMap(
            geojson, dataset, mapOptions,
            this.propertyDetector.detectWardCode.bind(this.propertyDetector),
            this.featureBuilder.buildHousePriceFeatures.bind(this.featureBuilder),
            'housePrice',
            dataset.wardData
        );
    }

    updateMapForCrimeRate(geojson: BoundaryGeojson, dataset: CrimeDataset, mapOptions: MapOptions): void {
        this.updateGenericMap(
            geojson, dataset, mapOptions,
            this.propertyDetector.detectLocalAuthorityCode.bind(this.propertyDetector),
            this.featureBuilder.buildCrimeRateFeatures.bind(this.featureBuilder),
            'crime',
            dataset.records
        );
    }

    updateMapForIncome(geojson: BoundaryGeojson, dataset: IncomeDataset, mapOptions: MapOptions): void {
        this.updateGenericMap(
            geojson, dataset, mapOptions,
            this.propertyDetector.detectLocalAuthorityCode.bind(this.propertyDetector),
            this.featureBuilder.buildIncomeFeatures.bind(this.featureBuilder),
            'income',
            dataset.localAuthorityData
        );
    }

    // Simplified stats calculation methods
    calculateLocalElectionStats(geojson: BoundaryGeojson, wardData: LocalElectionDataset['wardData'], location: string | null = null, datasetId: string | null = null) {
        return this.statsCalculator.calculateLocalElectionStats(geojson, wardData, location, datasetId);
    }

    calculateGeneralElectionStats(geojson: BoundaryGeojson, constituencyData: GeneralElectionDataset['constituencyData'], location: string | null = null, datasetId: string | null = null) {
        return this.statsCalculator.calculateGeneralElectionStats(geojson, constituencyData, location, datasetId);
    }

    calculatePopulationStats(geojson: BoundaryGeojson, populationData: PopulationDataset['populationData'], location: string | null = null, datasetId: string | null = null) {
        return this.statsCalculator.calculatePopulationStats(geojson, populationData, location, datasetId);
    }

    calculateHousePriceStats(geojson: BoundaryGeojson, wardData: HousePriceDataset['wardData'], location: string | null = null, datasetId: string | null = null) {
        return this.statsCalculator.calculateHousePriceStats(geojson, wardData, location, datasetId);
    }

    calculateCrimeStats(geojson: BoundaryGeojson, wardData: CrimeDataset['records'], location: string | null = null, datasetId: string | null = null) {
        return this.statsCalculator.calculateCrimeStats(geojson, wardData, location, datasetId);
    }

    calculateIncomeStats(geojson: BoundaryGeojson, localAuthorityData: IncomeDataset['localAuthorityData'], location: string | null = null, datasetId: string | null = null) {
        return this.statsCalculator.calculateIncomeStats(geojson, localAuthorityData, location, datasetId);
    }

    destroy(): void {
        this.eventHandler.destroy();
        propCache.clear(); // Clean up cache on destroy
    }
}