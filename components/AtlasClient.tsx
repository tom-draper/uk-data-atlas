"use client";

import { useState } from "react";
import MapInterface from "@components/MapInterface";
import ErrorDisplay from "@/components/displays/ErrorDisplay";
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

export default function AtlasClient() {
	const [activeViz, setActiveViz] = useState<ActiveViz>(DEFAULT_ACTIVE_VIZ);
	const [selectedLocation, setSelectedLocation] = useState(DEFAULT_LOCATION);
	const [customDataset, setCustomDataset] = useState<CustomDataset | null>(
		null,
	);

	const { datasets, loading, errors } = useDatasets();

	if (loading) return <LoadingDisplay />;
	if (errors.length > 0) return <ErrorDisplay message={errors[0]} />;

	return (
		<ErrorBoundary>
			<MapInterface
				datasets={datasets}
				selectedLocation={selectedLocation}
				setSelectedLocation={setSelectedLocation}
				activeViz={activeViz}
				setActiveViz={setActiveViz}
				customDataset={customDataset}
				setCustomDataset={setCustomDataset}
			/>
		</ErrorBoundary>
	);
}
