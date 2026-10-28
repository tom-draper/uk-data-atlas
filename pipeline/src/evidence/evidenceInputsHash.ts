import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "@uk-data-atlas/artifacts";

type HashInput = { contentHash: string };
type EvidenceInputs = {
	boundaryRegistry: HashInput;
	areaInventory: HashInput;
	namedLocationInventory: HashInput;
	crosswalkInventory: HashInput;
	relationshipPathInventory: HashInput;
	relationshipCandidateInventory: HashInput;
	geographyInventory: HashInput;
	dataCatalog: HashInput;
	exportManifest: HashInput;
	measureCompatibilityInventory: HashInput;
	analysisGeographyInventory: HashInput;
	analysisGeographyValidationInventory: HashInput;
};

export const evidenceInputsHash = (
	directory: string,
	context: EvidenceInputs,
) =>
	sha256(
		JSON.stringify([
			context.boundaryRegistry.contentHash,
			context.areaInventory.contentHash,
			context.namedLocationInventory.contentHash,
			context.crosswalkInventory.contentHash,
			context.relationshipPathInventory.contentHash,
			context.relationshipCandidateInventory.contentHash,
			context.geographyInventory.contentHash,
			context.dataCatalog.contentHash,
			context.exportManifest.contentHash,
			context.measureCompatibilityInventory.contentHash,
			context.analysisGeographyInventory.contentHash,
			context.analysisGeographyValidationInventory.contentHash,
			sha256(
				readFileSync(join(directory, "geometry-sources.json"), "utf8"),
			),
		]),
	);
