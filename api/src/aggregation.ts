import type { PopulationObservation } from "./dataCatalog";
import type { NamedLocation } from "./namedLocations";

export const aggregateLocationMembers = (
	location: NamedLocation,
	records: PopulationObservation[],
) => {
	const byCode = new Map(records.map((record) => [record.areaCode, record]));
	const members = location.memberCodes.flatMap((code) => {
		const record = byCode.get(code);
		return record ? [record] : [];
	});
	const unresolvedMemberCodes = location.memberCodes.filter(
		(code) => !byCode.has(code),
	);
	return {
		members,
		unresolvedMemberCodes,
		value: members.reduce((sum, record) => sum + record.value, 0),
	};
};

/**
 * The GSS code letter every area in a country shares with the country itself.
 *
 * This is definitional rather than geometric: the coding scheme assigns the
 * first character by country, so membership needs no boundary comparison and
 * cannot drift between releases.
 */
const COUNTRY_BY_LETTER: Record<string, string> = {
	E: "E92000001",
	N: "N92000002",
	S: "S92000003",
	W: "W92000004",
};

export const countryCodeFor = (areaCode: string): string | undefined =>
	COUNTRY_BY_LETTER[areaCode.slice(0, 1)];

export const isCountryCode = (code: string): boolean =>
	Object.values(COUNTRY_BY_LETTER).includes(code);

/**
 * Sum the observations of one country within a source partition.
 *
 * The total covers every area of that country the partition publishes, which
 * is not the same as national completeness: a partition covering England and
 * Wales only will still answer for England, and says so.
 */
export const aggregateCountryMembers = (
	countryCode: string,
	records: PopulationObservation[],
) => {
	const members = records.filter(
		(record) => countryCodeFor(record.areaCode) === countryCode,
	);
	return {
		members,
		value: members.reduce((sum, record) => sum + record.value, 0),
	};
};
