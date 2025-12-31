import { BoundaryGeojson } from "./geometry";

export type BoundaryType = keyof BoundaryData;

export type BoundaryData = {
	ward: {[year: string]: BoundaryGeojson | null};
	constituency: {[year: string]: BoundaryGeojson | null};
	localAuthority: {[year: string]: BoundaryGeojson | null};
};

export type BoundaryCodes = {
	ward: Record<number, Set<string>>;
	constituency: Record<number, Set<string>>;
	localAuthority: Record<number, Set<string>>;
}