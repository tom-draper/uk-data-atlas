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
	private readonly crosswalksById = new Map<
		string,
		CrosswalkInventory["crosswalks"][number]
	>();
	private readonly crosswalksByArtifact = new Map<
		string,
		CrosswalkInventory["crosswalks"][number]
	>();
	private readonly areaReleasesByIdentity = new Map<
		string,
		AreaInventory["releases"][number]
	>();
	private readonly areaReleasesByArtifact = new Map<
		string,
		AreaInventory["releases"][number]
	>();

	constructor(private readonly inputs: CatalogueResolverInputs) {
		for (const crosswalk of inputs.crosswalkInventory?.crosswalks ?? []) {
			if (!this.crosswalksById.has(crosswalk.id))
				this.crosswalksById.set(crosswalk.id, crosswalk);
			if (!this.crosswalksByArtifact.has(crosswalk.artifact))
				this.crosswalksByArtifact.set(crosswalk.artifact, crosswalk);
		}
		for (const release of inputs.areaInventory?.releases ?? []) {
			const identity = `${release.geography}/${release.id}`;
			if (!this.areaReleasesByIdentity.has(identity))
				this.areaReleasesByIdentity.set(identity, release);
			if (
				release.status === "available" &&
				!this.areaReleasesByArtifact.has(release.artifact)
			)
				this.areaReleasesByArtifact.set(release.artifact, release);
		}
	}

	crosswalkSummary(id: string) {
		return this.crosswalksById.get(id);
	}

	crosswalkSummaryForArtifact(artifact: string) {
		return this.crosswalksByArtifact.get(artifact);
	}

	crosswalkSummaries() {
		return this.inputs.crosswalkInventory?.crosswalks ?? [];
	}

	areaIdentityRelease(geography: string, boundaryRelease: string) {
		return this.areaReleasesByIdentity.get(
			`${geography}/${boundaryRelease}`,
		);
	}

	areaIdentityReleaseForArtifact(artifact: string) {
		return this.areaReleasesByArtifact.get(artifact);
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
