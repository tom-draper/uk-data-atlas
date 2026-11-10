import type { AreaRecord } from "@uk-data-atlas/areas";
import type {
	AnyMeasureObservationArtifact,
	DataCatalog,
} from "./dataCatalog.ts";
import type { MeasureCompatibilityInventory } from "./measureCompatibility.ts";
import type { ReconciliationContext } from "./reconciliationContext.ts";

/**
 * What measure capability and coverage read from a loaded release. The
 * reconciliation resolver plus the two lookups below, which the loader's
 * geography resolver satisfies.
 */
export type MeasureContext = {
	geographyResolver: ReconciliationContext["geographyResolver"] & {
		/** The areas of a release, or undefined when it is not compiled. */
		releaseAreas(
			geography: string,
			boundaryRelease: string,
		): Map<string, AreaRecord> | undefined;
		/** Why areas or crosswalks cannot be read, or undefined when they can. */
		missingRequirement(
			requirement: "areas" | "crosswalks",
		): string | undefined;
	};
	dataCatalog?: DataCatalog;
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
	measureObservations?: AnyMeasureObservationArtifact[];
};
