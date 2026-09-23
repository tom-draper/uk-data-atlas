import type { AreaLookup } from "../areaInventory";
import { reconcileMembers, reconcileMembersForYear } from "../memberReconciliation";
import type {
	LocationProjection,
	LocationProjectionStore,
} from "../locationProjections";
import type {
	NamedLocation,
	NamedLocationInventory,
	NamedLocationLookup,
} from "../namedLocations";
import type { CatalogueResolver } from "./catalogue";
import type { AreaIdentity } from "./areas";

export type LocationsResolverInputs = {
	areaLookup?: AreaLookup;
	namedLocationInventory?: NamedLocationInventory;
	namedLocationLookup?: NamedLocationLookup;
	locationProjectionStore?: LocationProjectionStore;
};

const memberAreaKey = (geography: string, code: string) => `${geography}/${code}`;

/** Named-location membership and its materialised projections. */
export class LocationsResolver {
	private readonly locationsByMemberArea = new Map<string, NamedLocation[]>();

	constructor(
		private readonly inputs: LocationsResolverInputs,
		private readonly catalogue: CatalogueResolver,
	) {
		for (const location of inputs.namedLocationInventory?.locations ?? [])
			for (const code of location.memberCodes) {
				const key = memberAreaKey(location.memberGeography, code);
				const locations = this.locationsByMemberArea.get(key) ?? [];
				locations.push(location);
				this.locationsByMemberArea.set(key, locations);
			}
		for (const locations of this.locationsByMemberArea.values())
			locations.sort((left, right) => left.id.localeCompare(right.id));
	}

	namedLocation(id: string): NamedLocation | undefined {
		return this.inputs.namedLocationLookup?.get(id);
	}

	namedLocations() {
		return this.inputs.namedLocationInventory?.locations ?? [];
	}

	hasNamedLocationInventory() {
		return this.inputs.namedLocationInventory !== undefined;
	}

	namedLocationsForArea(identity: AreaIdentity): NamedLocation[] {
		return (
			this.locationsByMemberArea.get(
				memberAreaKey(identity.geography, identity.code),
			) ?? []
		);
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
		const summaries = new Map(
			this.catalogue.crosswalkSummaries().map((summary) => [
				summary.id,
				summary,
			]),
		);
		return (
			this.inputs.locationProjectionStore?.memberProjectionShards() ?? []
		).flatMap((shard) => {
			const summary = summaries.get(shard.crosswalkId);
			return summary?.to.geography === memberGeography
				? [{ shard, summary }]
				: [];
		});
	}

	locationParentProjectionShards(memberGeography: string) {
		const summaries = new Map(
			this.catalogue.crosswalkSummaries().map((summary) => [
				summary.id,
				summary,
			]),
		);
		return (
			this.inputs.locationProjectionStore?.parentProjectionShards() ?? []
		).flatMap((shard) => {
			const summary = summaries.get(shard.crosswalkId);
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
		return this.inputs.locationProjectionStore?.parents(locationId, crosswalkId);
	}

	locationReleaseViews(memberGeography: string, memberCodes: string[]) {
		if (!this.inputs.areaLookup) return [];
		return [...this.inputs.areaLookup]
			.flatMap(([identity, areas]) => {
				const [geography, boundaryRelease] = identity.split("/", 2);
				if (geography !== memberGeography || !boundaryRelease) return [];
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
