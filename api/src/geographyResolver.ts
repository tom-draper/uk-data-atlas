import type { AreaLookup, AreaRecord } from "./areaInventory";
import {
	createAreaSearchIndex,
	searchAreas,
	type AreaSearchIndex,
} from "./areaSearch";
import {
	createAreaRelationshipIndex,
	type AreaRelationship,
	type AreaRelationshipIndex,
} from "./areaRelationships";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import { crosswalksTo } from "./locationMembership";
import {
	type LocationProjectionStore,
	type LocationProjection,
} from "./locationProjections";
import type { NamedLocation, NamedLocationLookup } from "./namedLocations";
import type {
	RelationshipPath,
	RelationshipPurpose,
} from "./relationshipPaths";

export type CrosswalkLookup = Map<string, CrosswalkArtifact>;

type AreaIdentity = {
	geography: string;
	boundaryRelease: string;
	code: string;
};

export type GeographyResolverInputs = {
	areaLookup?: AreaLookup;
	crosswalkInventory?: CrosswalkInventory;
	crosswalkLookup?: CrosswalkLookup;
	namedLocationLookup?: NamedLocationLookup;
	locationProjectionStore?: LocationProjectionStore;
	relationshipPathIndex?: Map<string, RelationshipPath[]>;
};

const areaId = ({ geography, boundaryRelease, code }: AreaIdentity) =>
	[geography, boundaryRelease, code].join("/");

/**
 * Read-only geography intelligence over one immutable Atlas release.
 *
 * The compiler produces the source artifacts; this facade owns the derived
 * runtime indexes so routes do not need to know how identities, crosswalks and
 * named places are stored. It intentionally exposes facts and relationships,
 * not measure conversion or HTTP concerns.
 */
export class GeographyResolver {
	private readonly areaSearchIndex?: AreaSearchIndex;
	private readonly areaRelationshipIndex?: AreaRelationshipIndex;
	private readonly crosswalksBySource = new Map<
		string,
		CrosswalkInventory["crosswalks"]
	>();

	constructor(private readonly inputs: GeographyResolverInputs) {
		if (inputs.areaLookup) {
			this.areaSearchIndex = createAreaSearchIndex(inputs.areaLookup);
		}
		if (inputs.crosswalkLookup) {
			this.areaRelationshipIndex = createAreaRelationshipIndex(
				inputs.crosswalkLookup.values(),
			);
		}
		for (const crosswalk of inputs.crosswalkInventory?.crosswalks ?? []) {
			const key = [
				crosswalk.from.geography,
				crosswalk.from.boundaryRelease,
				crosswalk.to.geography,
			].join("/");
			const candidates = this.crosswalksBySource.get(key) ?? [];
			candidates.push(crosswalk);
			this.crosswalksBySource.set(key, candidates);
		}
		for (const candidates of this.crosswalksBySource.values()) {
			candidates.sort((left, right) => left.id.localeCompare(right.id));
		}
	}

	area(identity: AreaIdentity): AreaRecord | undefined {
		return this.inputs.areaLookup
			?.get(`${identity.geography}/${identity.boundaryRelease}`)
			?.get(identity.code);
	}

	searchAreas(query: {
		geography?: string | null;
		boundaryRelease?: string | null;
		query?: string;
	}) {
		return this.areaSearchIndex ? searchAreas(this.areaSearchIndex, query) : [];
	}

	relationships(identity: AreaIdentity): AreaRelationship[] {
		return this.areaRelationshipIndex?.get(areaId(identity)) ?? [];
	}

	namedLocation(id: string): NamedLocation | undefined {
		return this.inputs.namedLocationLookup?.get(id);
	}

	crosswalk(id: string): CrosswalkArtifact | undefined {
		return this.inputs.crosswalkLookup?.get(id);
	}

	locationProjection(
		locationId: string,
		geography: string,
		boundaryRelease: string,
		crosswalkId: string,
	): LocationProjection | undefined {
		return this.inputs.locationProjectionStore?.get(
			locationId,
			geography,
			boundaryRelease,
			crosswalkId,
		);
	}

	relationshipPaths(
		from: { geography: string; boundaryRelease: string },
		to: { geography: string; boundaryRelease: string },
		purpose: RelationshipPurpose,
	) {
		return (
			this.inputs.relationshipPathIndex?.get(
				[
					from.geography,
					from.boundaryRelease,
					to.geography,
					to.boundaryRelease,
					purpose,
				].join("/"),
			) ?? []
		);
	}

	/** Crosswalks from a target geography/release into a location's LAD members. */
	crosswalksToLocationMembers(
		geography: string,
		boundaryRelease: string,
		memberGeography: string,
	) {
		const direct = this.crosswalksBySource.get(
			[geography, boundaryRelease, memberGeography].join("/"),
		);
		return direct ??
			(this.inputs.crosswalkInventory
				? crosswalksTo(
						this.inputs.crosswalkInventory,
						geography,
						boundaryRelease,
						memberGeography,
					)
				: []);
	}
}

export const createGeographyResolver = (inputs: GeographyResolverInputs) =>
	new GeographyResolver(inputs);
