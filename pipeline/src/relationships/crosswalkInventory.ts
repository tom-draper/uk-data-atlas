import { sha256 } from "@uk-data-atlas/artifacts";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "@uk-data-atlas/relationships";

type CrosswalkInventoryEntry = CrosswalkInventory["crosswalks"][number];

/**
 * What the inventory keeps of an artifact. A build holds these rather than
 * the artifacts, whose records run to hundreds of megabytes between them.
 */
export const crosswalkInventoryEntry = (
	artifact: CrosswalkArtifact,
): CrosswalkInventoryEntry => ({
	id: artifact.id,
	from: artifact.from,
	to: artifact.to,
	method: artifact.method,
	quality: artifact.quality,
	...(artifact.relationshipPurpose === undefined
		? {}
		: { relationshipPurpose: artifact.relationshipPurpose }),
	weighting: artifact.weighting,
	recordCount: artifact.records.length,
	artifact: `crosswalks/${artifact.id}.json`,
	contentHash: artifact.contentHash,
});

export const createCrosswalkInventory = (
	artifacts: CrosswalkArtifact[],
): CrosswalkInventory =>
	crosswalkInventoryFromEntries(artifacts.map(crosswalkInventoryEntry));

export const crosswalkInventoryFromEntries = (
	crosswalks: CrosswalkInventoryEntry[],
	releaseCoverage?: CrosswalkInventory["releaseCoverage"],
): CrosswalkInventory => {
	const content = JSON.stringify({ schemaVersion: 1, crosswalks });
	return {
		schemaVersion: 1,
		contentHash: sha256(content),
		crosswalks,
		...(releaseCoverage === undefined ? {} : { releaseCoverage }),
	};
};
