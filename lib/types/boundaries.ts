import { BoundaryGeojson } from "./geometry";

export type BoundaryType = keyof BoundaryData;

export type BoundaryData = {
	ward: {[year: string]: BoundaryGeojson | null};
	constituency: {[year: string]: BoundaryGeojson | null};
	localAuthority: {[year: string]: BoundaryGeojson | null};
};
