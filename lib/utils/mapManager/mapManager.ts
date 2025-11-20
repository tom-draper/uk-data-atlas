// lib/utils/mapManager/mapManager.ts
import { BoundaryGeojson, LocalElectionDataset, GeneralElectionDataset, PopulationDataset, HousePriceDataset } from '@lib/types';
import { MapOptions } from '@lib/types/mapOptions';
import { LayerManager } from './layerManager';
import { EventHandler } from './eventHandler';
import { StatsCalculator } from './statsCalculator';
import { FeatureBuilder } from './featureBuilder';
import { PropertyDetector } from './propertyDetector';
import { StatsCache } from './statsCache';

export interface MapManagerCallbacks {
    onWardHover?: (params: { data: any; wardCode: string }) => void;
    onConstituencyHover?: (data: any) => void;
    onLocationChange: (location: string) => void;
}

export type MapMode = 'local-election' | 'general-election' | 'population' | 'house-price';

export class MapManager {
    private layerManager: LayerManager;
    private eventHandler: EventHandler;
    private statsCalculator: StatsCalculator;
    private featureBuilder: FeatureBuilder;
    private propertyDetector: PropertyDetector;
    private cache: StatsCache;

    constructor(map: mapboxgl.Map, callbacks: MapManagerCallbacks) {
        this.layerManager = new LayerManager(map);
        this.eventHandler = new EventHandler(map, callbacks);
        this.propertyDetector = new PropertyDetector();
        this.featureBuilder = new FeatureBuilder();
        this.cache = new StatsCache();
        this.statsCalculator = new StatsCalculator(this.propertyDetector, this.cache);
    }

    // ============================================================================
    // Election Methods
    // ============================================================================

    updateMapForLocalElection(
        geojson: BoundaryGeojson,
        dataset: LocalElectionDataset,
        mapOptions: MapOptions
    ): void {
        const wardCodeProp = this.propertyDetector.detectWardCode(geojson);
        console.log('updateMapForLocalElection: Filtered wards', geojson.features.length);

        const mode = mapOptions['local-election'].mode || 'winner';
        const locationData = mode === 'party-percentage' && mapOptions['local-election'].selectedParty
            ? this.featureBuilder.buildPartyPercentageFeatures(
                geojson.features,
                dataset.wardData,
                mapOptions['local-election'].selectedParty,
                wardCodeProp
            )
            : this.featureBuilder.buildWinnerFeatures(
                geojson.features,
                wardCodeProp,
                (code) => dataset.wardResults[code] || 'NONE'
            );

        if (mode === 'party-percentage' && mapOptions['local-election'].selectedParty) {
            this.layerManager.updatePartyPercentageLayers(locationData, mapOptions['local-election']);
        } else {
            this.layerManager.updateElectionLayers(locationData, dataset.partyInfo);
        }

        this.eventHandler.setupEventHandlers('local-election', dataset.wardData, wardCodeProp);
    }

    updateMapForGeneralElection(
        geojson: BoundaryGeojson,
        dataset: GeneralElectionDataset,
        mapOptions: MapOptions
    ): void {
        const constituencyCodeProp = this.propertyDetector.detectConstituencyCode(geojson);
        console.log('updateMapForGeneralElection: Filtered constituencies:', geojson.features.length);

        const mode = mapOptions['general-election'].mode || 'winner';
        const locationData = mode === 'party-percentage' && mapOptions['general-election'].selectedParty
            ? this.featureBuilder.buildPartyPercentageFeatures(
                geojson.features,
                dataset.constituencyData,
                mapOptions['general-election'].selectedParty,
                constituencyCodeProp
            )
            : this.featureBuilder.buildWinnerFeatures(
                geojson.features,
                constituencyCodeProp,
                (code) => dataset.constituencyResults[code] || 'NONE'
            );

        if (mode === 'party-percentage' && mapOptions['general-election'].selectedParty) {
            this.layerManager.updatePartyPercentageLayers(locationData, mapOptions['general-election']);
        } else {
            this.layerManager.updateElectionLayers(locationData, dataset.partyInfo);
        }

        this.eventHandler.setupEventHandlers('general-election', dataset.constituencyData, constituencyCodeProp);
    }

    // ============================================================================
    // Population Methods
    // ============================================================================

    updateMapForAgeDistribution(
        geojson: BoundaryGeojson,
        dataset: PopulationDataset,
        mapOptions: MapOptions
    ): void {
        const wardCodeProp = this.propertyDetector.detectWardCode(geojson);
        const locationData = this.featureBuilder.buildAgeFeatures(geojson, dataset, wardCodeProp, mapOptions['age-distribution'], mapOptions.general.theme);
        
        this.layerManager.updateColoredLayers(locationData);
        this.eventHandler.setupEventHandlers('population', dataset.populationData, wardCodeProp);
    }

    updateMapForGender(
        geojson: BoundaryGeojson,
        dataset: PopulationDataset,
        mapOptions: MapOptions
    ): void {
        const wardCodeProp = this.propertyDetector.detectWardCode(geojson);
        const locationData = this.featureBuilder.buildGenderFeatures(geojson, dataset, wardCodeProp, mapOptions['gender']);
        
        this.layerManager.updateColoredLayers(locationData);
        this.eventHandler.setupEventHandlers('population', dataset.populationData, wardCodeProp);
    }

    updateMapForPopulationDensity(
        geojson: BoundaryGeojson,
        dataset: PopulationDataset,
        mapOptions: MapOptions
    ): void {
        const wardCodeProp = this.propertyDetector.detectWardCode(geojson);
        const locationData = this.featureBuilder.buildDensityFeatures(geojson, dataset, wardCodeProp, mapOptions['population-density'], mapOptions.general.theme);
        
        this.layerManager.updateColoredLayers(locationData);
        this.eventHandler.setupEventHandlers('population', dataset.populationData, wardCodeProp);
    }

    // ============================================================================
    // House Price Methods
    // ============================================================================

    updateMapForHousePrices(
        geojson: BoundaryGeojson,
        dataset: HousePriceDataset,
        mapOptions: MapOptions
    ): void {
        const wardCodeProp = this.propertyDetector.detectWardCode(geojson);
        const locationData = this.featureBuilder.buildHousePriceFeatures(geojson, dataset, wardCodeProp, mapOptions['house-price'], mapOptions.general.theme);
        
        this.layerManager.updateColoredLayers(locationData);
        this.eventHandler.setupEventHandlers('house-price', dataset.wardData, wardCodeProp);
    }

    // ============================================================================
    // Stats Calculation Methods
    // ============================================================================

    calculateLocalElectionStats(
        geojson: BoundaryGeojson,
        wardData: LocalElectionDataset['wardData'],
        location: string | null = null,
        datasetId: string | null = null
    ) {
        return this.statsCalculator.calculateLocalElectionStats(geojson, wardData, location, datasetId);
    }

    calculateGeneralElectionStats(
        geojson: BoundaryGeojson,
        constituencyData: GeneralElectionDataset['constituencyData'],
        location: string | null = null,
        datasetId: string | null = null
    ) {
        return this.statsCalculator.calculateGeneralElectionStats(geojson, constituencyData, location, datasetId);
    }

    calculatePopulationStats(
        geojson: BoundaryGeojson,
        populationData: PopulationDataset['populationData'],
        location: string | null = null,
        datasetId: string | null = null
    ) {
        return this.statsCalculator.calculatePopulationStats(geojson, populationData, location, datasetId);
    }

    calculateHousePriceStats(
        geojson: BoundaryGeojson,
        wardData: Record<string, any>,
        location: string | null = null,
        datasetId: string | null = null
    ) {
        return this.statsCalculator.calculateHousePriceStats(geojson, wardData, location, datasetId);
    }
}