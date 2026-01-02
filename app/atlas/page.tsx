"use client";

import { useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import MapInterface from "@components/MapInterface";
import ErrorDisplay from "@/components/displays/ErrorDisplay";
import LoadingDisplay from "@/components/displays/LoadingDisplay";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useDatasets } from "@/lib/hooks/useDatasets";
import { ActiveViz } from "@/lib/types";

export default function MapsPage() {
	const [activeViz, setActiveViz] = useState<ActiveViz>({
		vizId: "localElection2024",
		datasetType: "localElection",
		datasetYear: 2024,
	});
	const [selectedLocation, setSelectedLocation] =
		useState("Greater Manchester");

	const { datasets, loading, errors } = useDatasets();
	const [customDataset, setCustomDataset] = useState(null);

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
