import { areaKey, type AreaIdentity } from "@uk-data-atlas/geography";
import type { AreaRecord } from "./areaInventory.ts";

/** The stable id of an area identity: geography, release and code. */
export const areaId = ({ geography, boundaryRelease, code }: AreaIdentity) =>
	areaKey(geography, boundaryRelease, code);

export type ResolvedSameCodeArea = AreaRecord & {
	id: string;
	geography: string;
	boundaryRelease: string;
	/** The identifier recurs; no unchanged-boundary claim is implied. */
	status: "same-code-continuity";
};

export type ResolvedCodeRelease = AreaRecord & {
	id: string;
	geography: string;
	boundaryRelease: string;
};
