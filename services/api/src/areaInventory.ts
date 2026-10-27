import type {
	AreaRecord,
	AreaReleaseArtifact,
} from "../../../shared/areaInventory";
import { releaseKey } from "./geographyKeys";
export type {
	AreaRecord,
	AreaReleaseArtifact,
	AreaInventory,
	AreaLookup,
} from "../../../shared/areaInventory";

import type { AreaLookup } from "../../../shared/areaInventory";

export const createAreaLookup = (
	artifacts: AreaReleaseArtifact[],
): AreaLookup =>
	new Map(
		artifacts.map((artifact) => [
			releaseKey(artifact.geography, artifact.boundaryRelease),
			new Map(artifact.areas.map((area) => [area.code, area])),
		]),
	);
