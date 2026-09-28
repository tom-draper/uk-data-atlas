"use client";

import { useEffect, useMemo, useState } from "react";
import MapInterface from "@components/MapInterface";
import LoadingDisplay from "@/components/displays/LoadingDisplay";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useDatasets } from "@/lib/hooks/useDatasets";
import { useRoadSafetyData } from "@/lib/hooks/useRoadSafetyData";
import type { CustomDataset } from "@/lib/types/custom";
import { NETWORK_DATASETS } from "@/lib/data/networks/catalog";
import { useAtlasUrlState } from "@/lib/hooks/useAtlasUrlState";

function ErrorBanner({
	errors,
	onDismiss,
}: {
	errors: string[];
	onDismiss: () => void;
}) {
	if (errors.length === 0) return null;
	return (
		<div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] max-w-md w-full mx-3 pointer-events-auto">
			<div className="bg-red-50 border border-red-200 rounded-lg shadow-md px-4 py-3 flex items-start gap-3">
				<span className="text-red-500 mt-0.5 shrink-0">⚠</span>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium text-red-800">
						Some data failed to load
					</p>
					<p className="text-xs text-red-600 mt-0.5 truncate">
						{errors[0]}
					</p>
				</div>
				<button
					type="button"
					onClick={onDismiss}
					className="text-red-400 hover:text-red-600 shrink-0 text-lg leading-none"
					aria-label="Dismiss"
				>
					×
				</button>
			</div>
		</div>
	);
}

export default function AtlasClient() {
	const { activeViz, selectedLocation, setActiveViz, setSelectedLocation } =
		useAtlasUrlState();
	const [customDatasets, setCustomDatasets] = useState<CustomDataset[]>([]);
	const [errorsDismissed, setErrorsDismissed] = useState(false);
	const [boundaryErrors, setBoundaryErrors] = useState<string[]>([]);
	const [initialDatasetLoadComplete, setInitialDatasetLoadComplete] =
		useState(false);

	const {
		datasets,
		loading: datasetsLoading,
		errors,
	} = useDatasets(selectedLocation, activeViz.datasetType);
	// Only the selected dataset's points are worth fetching, so tell the loader
	// which visualisation is showing.
	const roadSafety = useRoadSafetyData(
		activeViz.datasetType === "custom" ? activeViz.datasetId : undefined,
	);
	const roadSafetyDatasets = useMemo(
		() => Object.values(roadSafety.datasets),
		[roadSafety.datasets],
	);
	// Hidden until a tile URL is configured (NEXT_PUBLIC_OS_OPEN_ROADS_TILE_URL),
	// so it stays off in production until we have somewhere to host the tiles.
	const networkDatasets = Object.values(NETWORK_DATASETS).filter(
		(dataset) => dataset.available,
	);

	useEffect(() => {
		if (!datasetsLoading) setInitialDatasetLoadComplete(true);
	}, [datasetsLoading]);

	const handleBoundaryError = (error: Error) => {
		setBoundaryErrors((prev) =>
			prev.includes(error.message) ? prev : [...prev, error.message],
		);
	};

	const allErrors = [...errors, ...boundaryErrors];

	if (datasetsLoading && !initialDatasetLoadComplete)
		return <LoadingDisplay />;

	return (
		<ErrorBoundary>
			{!errorsDismissed && (
				<ErrorBanner
					errors={allErrors}
					onDismiss={() => setErrorsDismissed(true)}
				/>
			)}
			<MapInterface
				datasets={datasets}
				datasetsLoading={datasetsLoading}
				selectedLocation={selectedLocation}
				setSelectedLocation={setSelectedLocation}
				activeViz={activeViz}
				setActiveViz={setActiveViz}
				customDatasets={customDatasets}
				addCustomDataset={(dataset) =>
					setCustomDatasets((prev) => [...prev, dataset])
				}
				roadSafetyDatasets={roadSafetyDatasets}
				networkDatasets={networkDatasets}
				onError={handleBoundaryError}
			/>
		</ErrorBoundary>
	);
}
