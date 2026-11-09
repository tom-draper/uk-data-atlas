import type { BoundaryRegistry } from "../index.ts";
import { readGeographyCatalogue } from "./geographyCatalogue.ts";

export const readBoundaryRegistry = (
	repositoryRoot: string,
): BoundaryRegistry =>
	readGeographyCatalogue<BoundaryRegistry>(
		repositoryRoot,
		"boundary-releases",
		"releases",
		"boundary registry",
	);
