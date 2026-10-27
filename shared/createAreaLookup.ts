import type { AreaLookup, AreaReleaseArtifact } from "./areaInventory";
import { releaseKey } from "./geographyKeys";

export const createAreaLookup = (
	artifacts: AreaReleaseArtifact[],
): AreaLookup =>
	new Map(
		artifacts.map((artifact) => [
			releaseKey(artifact.geography, artifact.boundaryRelease),
			new Map(artifact.areas.map((area) => [area.code, area])),
		]),
	);
