"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import MapInterface from "@components/MapInterface";
import LoadingDisplay from "@/components/displays/LoadingDisplay";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useDatasets } from "@/lib/hooks/useDatasets";
import { useRoadSafetyData } from "@/lib/hooks/useRoadSafetyData";
import type { ActiveViz } from "@/lib/types";
import type { CustomDataset } from "@/lib/types/custom";
import { NETWORK_DATASETS } from "@/lib/data/networks/catalog";

const DEFAULT_ACTIVE_VIZ: ActiveViz = {
	datasetId: "localElection2024",
	datasetType: "localElection",
	datasetYear: 2024,
};

const VIZ_VIEWS: readonly NonNullable<ActiveViz["view"]>[] = [
	"age",
	"density",
	"gender",
];

const DEFAULT_LOCATION = "Greater Manchester";

// The URL is the one place the visualisation is a flat string; everywhere else
// it stays split into the dataset it shows and which of its views.
function parseActiveVizFromParams(params: URLSearchParams): ActiveViz | null {
	const datasetId = params.get("viz");
	const datasetType = params.get("type");
	const datasetYear = params.get("year");
	if (!datasetId || !datasetType || !datasetYear) return null;
	const year = parseInt(datasetYear, 10);
	if (isNaN(year)) return null;
	const view = VIZ_VIEWS.find((candidate) => candidate === params.get("view"));
	return {
		datasetId,
		...(view ? { view } : {}),
		datasetType: datasetType as ActiveViz["datasetType"],
		datasetYear: year,
	};
}

function writeActiveVizParams(params: URLSearchParams, viz: ActiveViz) {
	params.set("viz", viz.datasetId);
	params.set("type", viz.datasetType);
	params.set("year", String(viz.datasetYear));
	if (viz.view) params.set("view", viz.view);
}

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
	const searchParams = useSearchParams();
	const getSearchParam = (key: string) => searchParams.get(key);

	const [activeViz, setActiveVizState] = useState<ActiveViz>(() => {
		return parseActiveVizFromParams(searchParams) ?? DEFAULT_ACTIVE_VIZ;
	});
	const [selectedLocation, setSelectedLocationState] = useState(() => {
		return getSearchParam("location") ?? DEFAULT_LOCATION;
	});
	const [customDatasets, setCustomDatasets] = useState<CustomDataset[]>([]);
	const [errorsDismissed, setErrorsDismissed] = useState(false);
	const [boundaryErrors, setBoundaryErrors] = useState<string[]>([]);
	const [initialDatasetLoadComplete, setInitialDatasetLoadComplete] =
		useState(false);

	const { datasets, loading: datasetsLoading, errors } = useDatasets();
	const roadSafety = useRoadSafetyData();
	const roadSafetyDatasets = Object.values(roadSafety.datasets);
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

	const activeVizRef = useRef(activeViz);
	const selectedLocationRef = useRef(selectedLocation);
	useEffect(() => {
		activeVizRef.current = activeViz;
		selectedLocationRef.current = selectedLocation;
	});

	const updateParams = (location: string, viz: ActiveViz) => {
		const params = new URLSearchParams();
		params.set("location", location);
		writeActiveVizParams(params, viz);
		window.history.replaceState(null, "", `?${params.toString()}`);
	};

	const setActiveViz = (viz: ActiveViz) => {
		setActiveVizState(viz);
		updateParams(selectedLocationRef.current, viz);
	};

	const setSelectedLocation = (location: string) => {
		setSelectedLocationState(location);
		updateParams(location, activeVizRef.current);
	};

	useEffect(() => {
		if (!getSearchParam("location")) {
			const params = new URLSearchParams();
			params.set("location", selectedLocation);
			writeActiveVizParams(params, activeViz);
			window.history.replaceState(null, "", `?${params.toString()}`);
		}
		// Only run on mount
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		document.title = selectedLocation
			? `${selectedLocation} - UK Data Atlas`
			: "UK Data Atlas";
	}, [selectedLocation]);

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
				selectedLocation={selectedLocation}
				setSelectedLocation={setSelectedLocation}
				activeViz={activeViz}
				setActiveViz={setActiveViz}
				customDatasets={customDatasets}
				addCustomDataset={(dataset) => setCustomDatasets((prev) => [...prev, dataset])}
				roadSafetyDatasets={roadSafetyDatasets}
				networkDatasets={networkDatasets}
				onError={handleBoundaryError}
			/>
		</ErrorBoundary>
	);
}
