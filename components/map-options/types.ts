import type { MapOptions } from "@/lib/types/mapOptions";

export type MapOptionsChangeHandler = (
	type: keyof MapOptions,
	options: Partial<MapOptions[typeof type]>,
) => void;

export type VisibilityToggle = Exclude<
	keyof MapOptions["visibility"],
	"overlayOpacity"
>;
