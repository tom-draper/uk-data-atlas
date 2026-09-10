"use client";

import { useMemo } from "react";
import type { BoundaryGeojson, BoundaryType, Dataset } from "@lib/types";
import { boundaryCapabilityFor } from "../data/boundaries/capabilities";
import { BOUNDARY_CATALOG } from "../data/boundaries/catalog";
import type { ConstituencyLadOverlaps } from "../data/boundaries/constituencyLadOverlaps";
import { getChartDatasetDefinition } from "../datasets";
import { filterGeometryToDatasetCoverage } from "../helpers/datasetCoverage";
import { useActiveGeometry } from "./useActiveGeometry";

type BoundaryDataset = Exclude<Dataset, { type: "network" }>;

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
		activeDataset.type === "network" ||
		!("data" in activeDataset)
	)
		return rawGeometry;

	const dataset = activeDataset as BoundaryDataset;
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
	const dataKeys = new Set(
		Object.keys(dataset.data as Record<string, unknown>),
	);
	// A country-specific payload can have no records even though the source
	// covers that country (for example, a year without Welsh elections). Keep
	// declared coverage visible, but preserve the empty-map behaviour when no
	// coverage is published at all.
	if (dataKeys.size === 0)
		return coverageCountries
			? coverageGeometry
			: { ...coverageGeometry, features: [] };

	const boundaryType = dataset.boundaryType as BoundaryType;
	const codeKeys: readonly string[] = boundaryCapabilityFor(boundaryType)
		.filterGeometryToDatasetData
		? BOUNDARY_CATALOG[boundaryType].properties.code
		: [];
	if (codeKeys.length === 0) return coverageGeometry;
	const firstProperties = coverageGeometry.features[0]
		?.properties as unknown as Record<string, unknown> | undefined;
	if (!firstProperties) return coverageGeometry;
	const codeKey = codeKeys.find((key) => key in firstProperties);
	if (!codeKey) return coverageGeometry;
	const features = coverageGeometry.features.filter(
		(feature) =>
			feature.properties &&
			dataKeys.has(
				(feature.properties as unknown as Record<string, unknown>)[
					codeKey
				] as string,
			),
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
		activeDataset?.type === "network" ? null : activeDataset;
	const activeGeometry = useActiveGeometry(
		boundaryDataset?.boundaryType as BoundaryType | undefined,
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
