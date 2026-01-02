import { BoundaryGeojson } from "./geometry";

export type BoundaryType = keyof BoundaryData;

export type BoundaryData = {
	ward: {[year: number]: BoundaryGeojson | null};
	constituency: {[year: number]: BoundaryGeojson | null};
	localAuthority: {[year: number]: BoundaryGeojson | null};
};

export type BoundaryCodes = {
	ward: Record<number, Set<string>>;
	constituency: Record<number, Set<string>>;
	localAuthority: Record<number, Set<string>>;
} | null