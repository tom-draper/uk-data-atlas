"use client";
import { PopulationDataset } from "@lib/types";
import TitlePane from "./TitlePane";
import LocationPane from "./LocationPanel";
import MapOptions from "./MapOptions";

import { MapOptions as MapOptionsType } from "@/lib/types/mapOptions";

interface ControlPanelProps {
	selectedLocation: string | null;
	onLocationClick: (location: string) => void;
	populationDataset: PopulationDataset | undefined;
	onZoomIn: () => void;
	onZoomOut: () => void;
	handleMapOptionsChange: (
		type: keyof MapOptionsType,
		options: Partial<MapOptionsType[typeof type]>,
	) => void;
	onExport: () => void;
	mapOptions: MapOptionsType;
}

export default function ControlPanel({
	selectedLocation,
	onLocationClick,
	populationDataset,
	onZoomIn,
	onZoomOut,
	handleMapOptionsChange,
	onExport,
	mapOptions,
}: ControlPanelProps) {
	return (
		<div className="flex flex-col h-full max-h-screen">
			<div className="pointer-events-auto p-2.5 pb-0 w-[320px] shrink-0">
				<TitlePane />
			</div>

			<div className="pointer-events-auto p-2.5 pb-0 w-[320px] flex-1 min-h-0">
				<LocationPane
					selectedLocation={selectedLocation}
					onLocationClick={onLocationClick}
					populationDataset={populationDataset}
				/>
			</div>

			<div className="pointer-events-auto p-2.5 w-[320px] shrink-0">
				<MapOptions
					onZoomIn={onZoomIn}
					onZoomOut={onZoomOut}
					handleMapOptionsChange={handleMapOptionsChange}
					mapOptions={mapOptions}
					onExport={onExport}
				/>
			</div>
		</div>
	);
}
