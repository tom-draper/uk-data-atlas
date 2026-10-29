import type {
	NamedLocation,
	NamedLocationInventory,
} from "./namedLocationTypes";
import {
	membersAt,
	selectNamedLocationAt,
	type NamedLocationLookup,
} from "./namedLocations";

const memberAreaKey = (geography: string, code: string) =>
	`${geography}/${code}`;

export class NamedLocationResolver {
	private readonly locationsByMemberArea = new Map<string, NamedLocation[]>();

	constructor(
		private readonly inventory?: NamedLocationInventory,
		private readonly lookup?: NamedLocationLookup,
	) {
		for (const location of inventory?.locations ?? [])
			for (const code of location.memberCodes) {
				const key = memberAreaKey(location.memberGeography, code);
				const locations = this.locationsByMemberArea.get(key) ?? [];
				locations.push(location);
				this.locationsByMemberArea.set(key, locations);
			}
		for (const locations of this.locationsByMemberArea.values())
			locations.sort((left, right) => left.id.localeCompare(right.id));
	}

	namedLocation(id: string, asOf?: string): NamedLocation | undefined {
		const location = this.lookup?.get(id);
		return location && selectNamedLocationAt(location, asOf);
	}
	namedLocations(asOf?: string) {
		return (this.inventory?.locations ?? []).map((location) =>
			selectNamedLocationAt(location, asOf),
		);
	}
	hasNamedLocationInventory() {
		return this.inventory !== undefined;
	}
	namedLocationsForArea(
		identity: { geography: string; code: string },
		asOf?: string,
	): NamedLocation[] {
		return (
			this.locationsByMemberArea.get(
				memberAreaKey(identity.geography, identity.code),
			) ?? []
		).filter((location) =>
			membersAt(location, asOf).includes(identity.code),
		);
	}
}
