import { featureAreaSqKm } from "@/lib/data/boundaries/derived";
import type { PopulationCodeResolver } from "@/lib/data/boundaries/codeMapper";
import { calculateTotal } from "@/lib/helpers/population";
import { detectWardCodeForYear } from "@/lib/helpers/mapManager/propertyDetector";
import type {
	AggregatedPopulationData,
	BoundaryData,
	BoundaryGeojson,
	Feature,
	PopulationDataset,
	SelectedArea,
} from "@/lib/types";
import { getFeatureProp } from "@/lib/types";
import {
	getAreaCachedValue,
	getLadCachedValue,
	populationAreaMappingsAvailable,
	resolvePopulationAreaWards,
	type PopulationWardRecord,
} from "./demographicData";

export type PopulationDensity = {
	density: number | null;
	areaSqKm: number | null;
	total: number | null;
};

export type PopulationDensityInput = {
	dataset: PopulationDataset;
	aggregatedData: Record<number, AggregatedPopulationData> | null;
	boundaryData: BoundaryData;
	selectedArea: SelectedArea | null;
	codeMapper?: PopulationCodeResolver;
};

const emptyDensity = (): PopulationDensity => ({
	density: null,
	areaSqKm: null,
	total: null,
});

const densityCache = new Map<string, Map<number, PopulationDensity>>();
const featureIndexCache = new WeakMap<object, Map<string, Feature>>();

const featureIndex = (
	geojson: BoundaryGeojson,
	wardCodeProp: string,
): Map<string, Feature> => {
	let index = featureIndexCache.get(geojson);
	if (!index) {
		index = new Map();
		for (const feature of geojson.features) {
			const code = feature.properties
				? getFeatureProp(feature.properties, wardCodeProp)
				: undefined;
			if (code) index.set(String(code), feature);
		}
		featureIndexCache.set(geojson, index);
	}
	return index;
};

const densityForWard = (feature: Feature, total: number): PopulationDensity => {
	const areaSqKm = featureAreaSqKm(feature);
	return {
		density: areaSqKm > 0 ? total / areaSqKm : 0,
		areaSqKm,
		total,
	};
};

const densityForWards = (
	wardRecords: PopulationWardRecord[] | null,
	geojson: BoundaryGeojson,
	dataset: PopulationDataset,
): PopulationDensity => {
	if (!wardRecords?.length) return emptyDensity();

	const wardCodeProp = detectWardCodeForYear(
		geojson.features,
		dataset.boundaryYear,
	);
	const features = featureIndex(geojson, wardCodeProp);
	let total = 0;
	let areaSqKm = 0;
	for (const wardRecord of wardRecords) {
		const feature = features.get(wardRecord.code);
		if (!feature) continue;
		total += calculateTotal(wardRecord.data.total);
		areaSqKm += featureAreaSqKm(feature);
	}
	return areaSqKm > 0
		? { density: total / areaSqKm, areaSqKm, total }
		: emptyDensity();
};

/** Resolves density values for the aggregate, ward, and mapped larger areas. */
export const resolvePopulationDensity = ({
	dataset,
	aggregatedData,
	boundaryData,
	selectedArea,
	codeMapper,
}: PopulationDensityInput): PopulationDensity => {
	if (selectedArea === null) {
		const aggregate = aggregatedData?.[dataset.year];
		return aggregate
			? {
					density: aggregate.density,
					areaSqKm: aggregate.totalArea,
					total: aggregate.populationStats.total,
				}
			: emptyDensity();
	}

	const geojson = boundaryData.ward[dataset.boundaryYear];
	if (!geojson) return emptyDensity();

	if (selectedArea.type === "ward") {
		const wardRecord = resolvePopulationAreaWards(
			dataset,
			selectedArea,
			codeMapper,
		)?.[0];
		if (!wardRecord) return emptyDensity();
		const wardCodeProp = detectWardCodeForYear(
			geojson.features,
			dataset.boundaryYear,
		);
		const feature = featureIndex(geojson, wardCodeProp).get(
			wardRecord.code,
		);
		return feature
			? densityForWard(feature, calculateTotal(wardRecord.data.total))
			: emptyDensity();
	}

	if (!populationAreaMappingsAvailable(selectedArea, codeMapper))
		return emptyDensity();

	const mappingGeneration = codeMapper?.getMappingGeneration() ?? 0;
	const calculate = () =>
		densityForWards(
			resolvePopulationAreaWards(dataset, selectedArea, codeMapper),
			geojson,
			dataset,
		);
	if (selectedArea.type === "localAuthority") {
		return getLadCachedValue(
			densityCache,
			selectedArea.code,
			dataset.year,
			dataset,
			mappingGeneration,
			calculate,
		);
	}
	if (selectedArea.type === "constituency") {
		return getAreaCachedValue(
			densityCache,
			`constituency-${selectedArea.code}`,
			dataset.year,
			dataset,
			mappingGeneration,
			calculate,
		);
	}

	return emptyDensity();
};
