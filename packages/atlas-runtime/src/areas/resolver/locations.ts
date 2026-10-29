import type { AreaLookup } from "@uk-data-atlas/areas";
import {
	reconcileMembers,
	reconcileMembersForYear,
} from "@uk-data-atlas/relationships";
import type {
	LocationProjection,
	LocationProjections,
} from "../../places/locationProjections";
import type {
	NamedLocationInventory,
	NamedLocationLookup,
} from "../../places/namedLocations";
import { NamedLocationResolver } from "@uk-data-atlas/places";
import type { CatalogueResolver } from "./catalogue";
import type { AreaIdentity } from "./areas";

export type LocationsResolverInputs = {
	areaLookup?: AreaLookup;
	namedLocationInventory?: NamedLocationInventory;
	namedLocationLookup?: NamedLocationLookup;
	locationProjectionStore?: LocationProjections;
};

/** Named-location membership and its materialised projections. */
export class LocationsResolver {
	private readonly named: NamedLocationResolver;

	constructor(
		private readonly inputs: LocationsResolverInputs,
		private readonly catalogue: CatalogueResolver,
	) {
		this.named = new NamedLocationResolver(
			inputs.namedLocationInventory,
			inputs.namedLocationLookup,
		);
	}

	namedLocation(id: string, asOf?: string) {
		return this.named.namedLocation(id, asOf);
	}
	namedLocations(asOf?: string) {
		return this.named.namedLocations(asOf);
	}
	hasNamedLocationInventory() {
		return this.named.hasNamedLocationInventory();
	}
	namedLocationsForArea(identity: AreaIdentity, asOf?: string) {
		return this.named.namedLocationsForArea(identity, asOf);
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

	hasLocationProjectionStore() {
		return this.inputs.locationProjectionStore !== undefined;
	}

	locationMemberProjectionShards(memberGeography: string) {
		return (
			this.inputs.locationProjectionStore?.memberProjectionShards() ?? []
		).flatMap((shard) => {
			const summary = this.catalogue.crosswalkSummary(shard.crosswalkId);
			return summary?.to.geography === memberGeography
				? [{ shard, summary }]
				: [];
		});
	}

	locationParentProjectionShards(memberGeography: string) {
		return (
			this.inputs.locationProjectionStore?.parentProjectionShards() ?? []
		).flatMap((shard) => {
			const summary = this.catalogue.crosswalkSummary(shard.crosswalkId);
			return summary?.from.geography === memberGeography
				? [{ shard, summary }]
				: [];
		});
	}

	locationParentCrosswalks(geography: string, boundaryRelease: string) {
		return (
			this.inputs.locationProjectionStore?.parentCrosswalks(
				geography,
				boundaryRelease,
			) ?? []
		);
	}

	locationParents(locationId: string, crosswalkId: string) {
		return this.inputs.locationProjectionStore?.parents(
			locationId,
			crosswalkId,
		);
	}

	locationReleaseViews(memberGeography: string, memberCodes: string[]) {
		if (!this.inputs.areaLookup) return [];
		return [...this.inputs.areaLookup]
			.flatMap(([identity, areas]) => {
				const [geography, boundaryRelease] = identity.split("/", 2);
				if (geography !== memberGeography || !boundaryRelease)
					return [];
				return [
					{
						geography,
						boundaryRelease,
						resolvedMemberCount: memberCodes.filter((code) =>
							areas.has(code),
						).length,
					},
				];
			})
			.sort((left, right) =>
				left.boundaryRelease.localeCompare(right.boundaryRelease),
			);
	}

	reconcileMembers(
		geography: string,
		boundaryRelease: string,
		memberCodes: string[],
		resolvedCodes: Set<string>,
	) {
		return this.inputs.areaLookup
			? reconcileMembers(
					this.inputs.areaLookup,
					geography,
					boundaryRelease,
					memberCodes,
					resolvedCodes,
				)
			: undefined;
	}

	reconcileMembersForYear(
		geography: string,
		boundaryYear: number,
		memberCodes: string[],
		resolvedCodes: Set<string>,
	) {
		return this.inputs.areaLookup
			? reconcileMembersForYear(
					this.inputs.areaLookup,
					geography,
					boundaryYear,
					memberCodes,
					resolvedCodes,
				)
			: undefined;
	}

	crosswalksToLocationMembers(
		geography: string,
		boundaryRelease: string,
		memberGeography: string,
	) {
		return this.catalogue
			.crosswalkSummaries()
			.filter(
				(crosswalk) =>
					crosswalk.from.geography === geography &&
					crosswalk.from.boundaryRelease === boundaryRelease &&
					crosswalk.to.geography === memberGeography,
			)
			.sort((left, right) => left.id.localeCompare(right.id));
	}
}
