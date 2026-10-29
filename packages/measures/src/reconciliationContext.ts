import type {
	CrosswalkArtifact,
	CrosswalkInventory,
	IndexedPathStep,
	RelationshipPath,
	RelationshipPurpose,
} from "@uk-data-atlas/relationships";
import type { AnyMeasureObservationArtifact, DataCatalog } from "./dataCatalog";
import type { MeasureCompatibilityInventory } from "./measureCompatibility";

type Endpoint = { geography: string; boundaryRelease: string };
type CrosswalkSummary = CrosswalkInventory["crosswalks"][number];
export type ReconciliationContext = {
	geographyResolver: {
		crosswalkSummary(id: string): CrosswalkSummary | undefined;
		crosswalk(id: string): CrosswalkArtifact | undefined;
		crosswalkSummaries(): CrosswalkSummary[];
		relationshipPath(id: string): RelationshipPath | undefined;
		publishedRelationshipPaths(): RelationshipPath[];
		indexedPathSteps(
			path: RelationshipPath,
		): { steps: IndexedPathStep[] } | { missingCrosswalkId: string };
		relationshipCapability(
			from: Endpoint,
			to: Endpoint,
			purpose: RelationshipPurpose,
		): { paths: RelationshipPath[] };
	};
	dataCatalog?: DataCatalog;
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
	measureObservations?: AnyMeasureObservationArtifact[];
};
