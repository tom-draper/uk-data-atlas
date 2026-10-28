import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import { readGeographyCatalogue } from "./geographyCatalogue";

export const readBoundaryRegistry = (apiRoot: string): BoundaryRegistry =>
	readGeographyCatalogue<BoundaryRegistry>(
		apiRoot,
		"boundary-releases",
		"releases",
		"boundary registry",
	);
