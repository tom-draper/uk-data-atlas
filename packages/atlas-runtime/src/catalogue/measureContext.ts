import type { GeographyResolver } from "../areas/geographyResolver";
import type { AnyMeasureObservationArtifact, DataCatalog } from "@uk-data-atlas/measures";
import type { MeasureCompatibilityInventory } from "@uk-data-atlas/measures";

export type MeasureContext = {
	geographyResolver: GeographyResolver;
	dataCatalog?: DataCatalog;
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
	measureObservations?: AnyMeasureObservationArtifact[];
};
