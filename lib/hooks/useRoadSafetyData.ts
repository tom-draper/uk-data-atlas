import { useMemo } from "react";
import { CustomDataset, CustomPoint } from "../types/custom";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

const DATASETS_URL = withCDN("/data/precompiled/road-safety.json");
const POINTS_URL = withCDN("/data/precompiled/road-safety-points.json");

/**
 * The collision dataset, whose points are fetched only once it is selected.
 *
 * Every page load used to pay for the whole national point set — 6 MB over the
 * wire and ~10 MB of heap for 48,471 collisions — whether or not anyone opened
 * it. The card only needs a count and a mean severity for the current location,
 * and those are precompiled into the small dataset file, so the points are left
 * until the map actually has to draw them.
 *
 * @param selectedDatasetId The id of the visualisation currently selected, or
 * undefined. Its points are fetched when it is one of these datasets.
 */
export const useRoadSafetyData = (
	selectedDatasetId?: string,
	enabled = true,
) => {
	const { datasets, loading, error } = useJsonDataLoader<CustomDataset>(
		DATASETS_URL,
		enabled,
	);

	const pointsWanted =
		enabled &&
		selectedDatasetId !== undefined &&
		selectedDatasetId in datasets;

	// Once fetched the points stay loaded, so returning to the dataset after
	// looking at another one does not pay for it twice.
	const { datasets: pointsById } = useJsonDataLoader<CustomPoint[]>(
		POINTS_URL,
		pointsWanted,
	);

	return useMemo(() => {
		const withPoints = Object.fromEntries(
			Object.entries(datasets).map(([id, dataset]) => {
				const points = pointsById[id];
				return [id, points ? { ...dataset, points } : dataset];
			}),
		);
		return { datasets: withPoints, loading, error };
	}, [datasets, pointsById, loading, error]);
};
