import { useState } from "react";
import { Upload } from "lucide-react";
import { ActiveViz, BoundaryCodes, CustomDataset } from "@/lib/types";
import { AreaBank } from "@lib/data/areaBank";
import { useMatchIndex } from "@/lib/hooks/useMatchIndex";
import {
	createCustomDataset,
	type CustomDatasetUpload,
} from "@/lib/data/custom/dataset";
import type { SelectedCustomArea } from "./types";
import { BoundaryData } from "@lib/types/boundaries";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { useIsDark } from "@/lib/context/ThemeContext";
import { CustomDatasetCard } from "./CustomDatasetCard";
import { UploadModal } from "./UploadModal";

export default function CustomSection({
	customDatasets,
	addCustomDataset,
	selectedArea,
	boundaryCodes: _boundaryCodes,
	activeViz,
	setActiveViz,
	codeMapper,
	mapManager,
	boundaryData,
	location,
}: {
	customDatasets: CustomDataset[];
	addCustomDataset: (dataset: CustomDataset) => void;
	selectedArea: SelectedCustomArea | null;
	boundaryCodes: BoundaryCodes;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper?: CodeMapper;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}) {
	const [isOpen, setIsOpen] = useState(false);
	// Match index loads lazily only while the upload modal is open.
	const { areaBank } = useMatchIndex(isOpen);
	const isDark = useIsDark();

	const handleCustomDatasetApply = (data: CustomDatasetUpload) => {
		const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
		const dataset = createCustomDataset(id, data);
		if (!dataset) return;

		addCustomDataset(dataset);
		setActiveViz({
			datasetId: id,
			datasetType: "custom",
			datasetYear: dataset.boundaryYear,
		});

		setIsOpen(false);
	};

	return (
		<>
			<div
				className={`space-y-2 border-t pt-4 pb-2 ${isDark ? "border-white/10" : "border-gray-200"}`}
			>
				<h3
					className={`text-xs font-bold ${isDark ? "text-gray-200" : "text-gray-700"}`}
				>
					Custom Dataset
				</h3>

				{customDatasets.map((ds) =>
					codeMapper ? (
						<CustomDatasetCard
							key={ds.id}
							customDataset={ds}
							selectedArea={selectedArea}
							isActive={activeViz.datasetType === "custom" && activeViz.datasetId === ds.id}
							setActiveViz={setActiveViz}
							codeMapper={codeMapper}
							mapManager={mapManager}
							boundaryData={boundaryData}
							location={location}
						/>
					) : (
						<div
							key={ds.id}
							className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}
						>
							Loading…
						</div>
					),
				)}

				<button
					type="button"
					onClick={() => setIsOpen(true)}
					className={`w-full h-20 p-3 rounded-md transition-colors duration-150 border-2 border-dashed cursor-pointer ${
						isDark
							? "border-white/20 hover:border-gray-400 text-gray-500"
							: "border-gray-300/80 hover:border-gray-400 text-gray-400/80"
					}`}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth="2"
						stroke="currentColor"
						className="size-6 mx-auto mb-0.5"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M12 4.5v15m7.5-7.5h-15"
						/>
					</svg>
					<span className="text-xs font-medium">Upload Dataset</span>
				</button>
			</div>

			<UploadModal
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				onUpload={handleCustomDatasetApply}
				areaBank={areaBank}
			/>
		</>
	);
}
