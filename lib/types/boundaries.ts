import { BoundaryGeojson } from "./geometry";

export type BoundaryType = keyof BoundaryData;

export type BoundaryData = {
	ward: Record<number, BoundaryGeojson | null>;
	constituency: Record<number, BoundaryGeojson | null>;
	localAuthority: Record<number, BoundaryGeojson | null>;
};
