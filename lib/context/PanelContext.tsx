import { createContext, use } from "react";
import type { SelectedArea } from "@lib/types";

interface PanelContextValue {
	selectedArea: SelectedArea | null;
	selectedLocation: string | null;
}

export const PanelContext = createContext<PanelContextValue>({
	selectedArea: null,
	selectedLocation: null,
});

export const usePanelContext = () => use(PanelContext);
