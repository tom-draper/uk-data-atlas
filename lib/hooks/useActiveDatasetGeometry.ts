"use client";

import { useMemo } from "react";
import type { BoundaryGeojson, BoundaryType, Dataset } from "@lib/types";
import { boundaryCapabilityFor } from "../data/boundaries/capabilities";
import {
	BOUNDARY_CATALOG,
	BOUNDARY_TYPES,
} from "../data/boundaries/catalog";
import { getProp } from "../data/boundaries/properties";
import type { ConstituencyLadOverlaps } from "../data/boundaries/constituencyLadOverlaps";
import { getChartDatasetDefinition } from "../datasets";
import { filterGeometryToDatasetCoverage } from "../helpers/datasetCoverage";
import { useActiveGeometry } from "./useActiveGeometry";

type BoundaryDataset = Exclude<Dataset, { type: "network" }>;
type DatasetWithBoundaryData = BoundaryDataset & {
	boundaryType: BoundaryType;
	data: Record<string, unknown>;
};

const BOUNDARY_TYPE_SET = new Set<string>(BOUNDARY_TYPES);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isDatasetWithBoundaryData = (
	dataset: Dataset,
): dataset is DatasetWithBoundaryData =>
	dataset.type !== "network" &&
	typeof dataset.boundaryType === "string" &&
	BOUNDARY_TYPE_SET.has(dataset.boundaryType) &&
	isRecord(dataset.data);

/**
 * Applies dataset coverage and record availability to fetched boundary
 * geometry. The map still shows areas in a declared country coverage even when
 * that particular release has no records for them.
 */
export const prepareActiveDatasetGeometry = (
	rawGeometry: BoundaryGeojson | null,
	activeDataset: Dataset | null,
): BoundaryGeojson | null => {
	if (
		!rawGeometry ||
		!activeDataset ||
		!isDatasetWithBoundaryData(activeDataset)
	)
		return rawGeometry;

	const dataset = activeDataset;
	// The compiled payload carries coverage for production data, while the
	// definition keeps the map correct if a client still has a prior payload
	// after a hot reload or CDN update.
	const coverageCountries =
		dataset.coverageCountries ??
		getChartDatasetDefinition(dataset.type)?.coverageCountries;
	const coverageDataset = coverageCountries
		? { ...dataset, coverageCountries }
		: dataset;
	const coverageGeometry = filterGeometryToDatasetCoverage(
		rawGeometry,
		coverageDataset,
	);
	const dataKeys = new Set(Object.keys(dataset.data));
	// A country-specific payload can have no records even though the source
	// covers that country (for example, a year without Welsh elections). Keep
	// declared coverage visible, but preserve the empty-map behaviour when no
	// coverage is published at all.
	if (dataKeys.size === 0)
		return coverageCountries
			? coverageGeometry
			: { ...coverageGeometry, features: [] };

	const boundaryType = dataset.boundaryType;
	const codeKeys: readonly string[] = boundaryCapabilityFor(boundaryType)
		.filterGeometryToDatasetData
		? BOUNDARY_CATALOG[boundaryType].properties.code
		: [];
	if (codeKeys.length === 0) return coverageGeometry;
	const firstFeature = coverageGeometry.features[0];
	if (!firstFeature) return coverageGeometry;
	const codeKey = codeKeys.find(
		(key) => getProp(firstFeature.properties, [key]) !== undefined,
	);
	if (!codeKey) return coverageGeometry;
	const features = coverageGeometry.features.filter(
		(feature) => {
			const code = getProp(feature.properties, [codeKey]);
			return code !== undefined && dataKeys.has(code);
		},
	);
	return features.length === coverageGeometry.features.length
		? coverageGeometry
		: { ...coverageGeometry, features };
};

/** Fetches the active boundary vintage and prepares it for map rendering. */
export const useActiveDatasetGeometry = (
	activeDataset: Dataset | null,
	selectedLocation: string | null,
	getLadForWard?: (wardCode: string) => string | undefined,
	constituencyLadOverlaps?: ConstituencyLadOverlaps | null,
) => {
	const boundaryDataset =
		activeDataset && isDatasetWithBoundaryData(activeDataset)
			? activeDataset
			: null;
	const activeGeometry = useActiveGeometry(
		boundaryDataset?.boundaryType,
		boundaryDataset?.boundaryYear,
		selectedLocation,
		getLadForWard,
		constituencyLadOverlaps,
	);
	const geometry = useMemo(
		() =>
			prepareActiveDatasetGeometry(
				activeGeometry.geometry,
				activeDataset,
			),
		[activeGeometry.geometry, activeDataset],
	);

	return { ...activeGeometry, geometry };
};
