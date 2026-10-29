import type {
	NamedLocation,
	NamedLocationInventory,
} from "./namedLocationTypes";
export type NamedLocationLookup = Map<string, NamedLocation>;

export const createNamedLocationLookup = (
	inventory: NamedLocationInventory,
): NamedLocationLookup =>
	new Map(inventory.locations.map((location) => [location.id, location]));

/** Select codes whose half-open membership interval includes `asOf`. */
export const memberCodesAt = (
	memberCodes: string[],
	memberAssertions: NamedLocation["memberAssertions"],
	validity: NamedLocation["validity"],
	asOf?: string,
) =>
	(
		memberAssertions ??
		memberCodes.map((code) => ({
			code,
			validity,
		}))
	)
		.filter(
			({ validity }) =>
				asOf === undefined ||
				((validity.from === null || validity.from <= asOf) &&
					(validity.to === null || asOf < validity.to)),
		)
		.map(({ code }) => code);

/** Select the codes whose half-open membership interval includes `asOf`. */
export const membersAt = (location: NamedLocation, asOf?: string) =>
	memberCodesAt(
		location.memberCodes,
		location.memberAssertions,
		location.validity,
		asOf,
	);

/** A dated view leaves the full membership audit trail attached to the location. */
export const selectNamedLocationAt = (
	location: NamedLocation,
	asOf?: string,
): NamedLocation =>
	asOf === undefined
		? location
		: { ...location, memberCodes: membersAt(location, asOf) };
