import type { SelectedArea } from "@/lib/types";

export const isLocalAuthorityEstimate = (
	selectedArea: SelectedArea | null,
	hasData: boolean,
) => selectedArea?.type === "ward" && hasData;

export const LOCAL_AUTHORITY_ESTIMATE_NOTE =
	"This ward is represented by its local authority; the figure is not ward-level data.";
