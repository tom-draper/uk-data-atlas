import type { AreaInventory } from "../areaInventory";
import type { CrosswalkInventory } from "../crosswalkInventory";
import type { NamedLocationInventory } from "../namedLocations";

export type CatalogueResolverInputs = {
	areaInventory?: AreaInventory;
	crosswalkInventory?: CrosswalkInventory;
	namedLocationInventory?: NamedLocationInventory;
};

/** Summary and inventory lookups for compiled geography catalogue artifacts. */
export class CatalogueResolver {
	constructor(private readonly inputs: CatalogueResolverInputs) {}

	crosswalkSummary(id: string) {
		return this.inputs.crosswalkInventory?.crosswalks.find(
			(crosswalk) => crosswalk.id === id,
		);
	}

	crosswalkSummaryForArtifact(artifact: string) {
		return this.inputs.crosswalkInventory?.crosswalks.find(
			(crosswalk) => crosswalk.artifact === artifact,
		);
	}

	crosswalkSummaries() {
		return this.inputs.crosswalkInventory?.crosswalks ?? [];
	}

	areaIdentityRelease(geography: string, boundaryRelease: string) {
		return this.inputs.areaInventory?.releases.find(
			(release) =>
				release.geography === geography &&
				release.id === boundaryRelease,
		);
	}

	areaIdentityReleaseForArtifact(artifact: string) {
		return this.inputs.areaInventory?.releases.find(
			(release) =>
				release.status === "available" && release.artifact === artifact,
		);
	}

	namedLocationMembershipInventory() {
		const inventory = this.inputs.namedLocationInventory;
		return inventory
			? {
					contentHash: inventory.contentHash,
					locations: inventory.locations,
				}
			: undefined;
	}
}
