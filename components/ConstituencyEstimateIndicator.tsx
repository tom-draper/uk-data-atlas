import type { SelectedArea } from "@/lib/types";

export const isConstituencyEstimate = (
	selectedArea: SelectedArea | null,
	hasData: boolean,
) => selectedArea?.type === "ward" && hasData;

export const CONSTITUENCY_ESTIMATE_NOTE =
	"This ward is represented by its best-fit constituency; the figure is not ward-level data.";
