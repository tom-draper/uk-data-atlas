import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
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
