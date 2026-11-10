import type { AreaIdentity } from "@uk-data-atlas/geography";
import type { PostcodeAreaIndex, PostcodeAreaMatch } from "./postcodeAreas.ts";
import type { PostcodeCountsIndex } from "./postcodeCounts.ts";
import type { PostcodeIndex } from "./postcodeIndex.ts";

export type PostcodeResolverInputs = {
	postcodeIndex?: PostcodeIndex;
	postcodeAreaIndex?: PostcodeAreaIndex;
	postcodeCountsIndex?: PostcodeCountsIndex;
};

/**
 * What turns a postcode's compiled placements into resolved areas. The caller
 * chooses the resolved shape, which `PostcodeResolver` passes through.
 */
export type PlacedAreaResolver<Placed> = {
	resolvePlacedAreas(
		geography: string,
		boundaryRelease: string,
		placed: PostcodeAreaMatch[],
	): Placed;
};

/** Postcode indexes and area placements for a release. */
export class PostcodeResolver<Placed> {
	private readonly inputs: PostcodeResolverInputs;
	private readonly spatial: PlacedAreaResolver<Placed>;
	constructor(
		inputs: PostcodeResolverInputs,
		spatial: PlacedAreaResolver<Placed>,
	) {
		this.inputs = inputs;
		this.spatial = spatial;
	}
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
	) {
		const matches = this.inputs.postcodeAreaIndex?.containing(
			postcode,
			geography,
			boundaryRelease,
		);
		if (!matches) return undefined;
		return this.spatial.resolvePlacedAreas(
			geography,
			boundaryRelease,
			matches,
		);
	}
}
