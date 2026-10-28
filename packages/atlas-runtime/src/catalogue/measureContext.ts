import type { GeographyResolver } from "../areas/geographyResolver";
import type { AnyMeasureObservationArtifact, DataCatalog } from "./dataCatalog";
import type { MeasureCompatibilityInventory } from "./measureCompatibility";

export type MeasureContext = {
	geographyResolver: GeographyResolver;
	dataCatalog?: DataCatalog;
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
	measureObservations?: AnyMeasureObservationArtifact[];
};
