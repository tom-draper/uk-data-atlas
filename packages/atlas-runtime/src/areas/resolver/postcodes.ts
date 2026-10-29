import type {
	PostcodeAreaIndex,
	PostcodeCountsIndex,
	PostcodeIndex,
} from "@uk-data-atlas/postcodes";
import type { AreaIdentity } from "./areas";
import type { SpatialResolver } from "./spatial";

export type PostcodeResolverInputs = {
	postcodeIndex?: PostcodeIndex;
	postcodeAreaIndex?: PostcodeAreaIndex;
	postcodeCountsIndex?: PostcodeCountsIndex;
};

/** Postcode indexes and area placements for a release. */
export class PostcodeResolver {
	constructor(private readonly inputs: PostcodeResolverInputs) {}
	postcodeIndex() {
		return this.inputs.postcodeIndex;
	}
	postcodeAreaIndex() {
		return this.inputs.postcodeAreaIndex;
	}
	postcodeCounts(identity: AreaIdentity) {
		return this.inputs.postcodeCountsIndex?.forArea(
			identity.geography,
			identity.boundaryRelease,
			identity.code,
		);
	}
	postcodeContainingAreas(
		postcode: string,
		geography: string,
		boundaryRelease: string,
		spatial: Pick<SpatialResolver, "resolvePlacedAreas">,
	) {
		const matches = this.inputs.postcodeAreaIndex?.containing(
			postcode,
			geography,
			boundaryRelease,
		);
		if (!matches) return undefined;
		return spatial.resolvePlacedAreas(geography, boundaryRelease, matches);
	}
}
