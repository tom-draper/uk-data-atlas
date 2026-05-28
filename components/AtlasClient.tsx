"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MapInterface from "@components/MapInterface";
import LoadingDisplay from "@/components/displays/LoadingDisplay";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useDatasets } from "@/lib/hooks/useDatasets";
import type { ActiveViz } from "@/lib/types";
import type { CustomDataset } from "@/lib/types/custom";

const DEFAULT_ACTIVE_VIZ: ActiveViz = {
	vizId: "localElection2024",
	datasetType: "localElection",
	datasetYear: 2024,
};

const DEFAULT_LOCATION = "Greater Manchester";

function parseActiveVizFromParams(params: URLSearchParams): ActiveViz | null {
	const vizId = params.get("viz");
	const datasetType = params.get("type");
	const datasetYear = params.get("year");
	if (!vizId || !datasetType || !datasetYear) return null;
	const year = parseInt(datasetYear, 10);
	if (isNaN(year)) return null;
	return {
		vizId,
		datasetType: datasetType as ActiveViz["datasetType"],
		datasetYear: year,
	};
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
	const { replace } = useRouter();
	const searchParams = useSearchParams();
	const { get: getSearchParam } = searchParams;

	const [activeViz, setActiveVizState] = useState<ActiveViz>(() => {
		return parseActiveVizFromParams(searchParams) ?? DEFAULT_ACTIVE_VIZ;
	});
	const [selectedLocation, setSelectedLocationState] = useState(() => {
		return getSearchParam("location") ?? DEFAULT_LOCATION;
	});
	const [customDataset, setCustomDataset] = useState<CustomDataset | null>(
		null,
	);
	const [errorsDismissed, setErrorsDismissed] = useState(false);
	const [boundaryErrors, setBoundaryErrors] = useState<string[]>([]);

	const { datasets, loading, errors } = useDatasets();

	const handleBoundaryError = (error: Error) => {
		setBoundaryErrors((prev) =>
			prev.includes(error.message) ? prev : [...prev, error.message],
		);
	};

	const allErrors = [...errors, ...boundaryErrors];

	const activeVizRef = useRef(activeViz);
	activeVizRef.current = activeViz;
	const selectedLocationRef = useRef(selectedLocation);
	selectedLocationRef.current = selectedLocation;

	const updateParams = (location: string, viz: ActiveViz) => {
		const params = new URLSearchParams();
		params.set("location", location);
		params.set("viz", viz.vizId);
		params.set("type", viz.datasetType);
		params.set("year", String(viz.datasetYear));
		replace(`?${params.toString()}`, { scroll: false });
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
			updateParams(selectedLocation, activeViz);
		}
		// Only run on mount
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		document.title = selectedLocation
			? `${selectedLocation} - UK Data Atlas`
			: "UK Data Atlas";
	}, [selectedLocation]);

	if (loading) return <LoadingDisplay />;

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
				customDataset={customDataset}
				setCustomDataset={setCustomDataset}
				onError={handleBoundaryError}
			/>
		</ErrorBoundary>
	);
}
