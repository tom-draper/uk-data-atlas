import { SelectedArea } from "@/lib/types/areas";

export interface MapManagerCallbacks {
	onAreaHover?: (location: SelectedArea | null) => void;
	onLocationChange: (location: string) => void;
}
