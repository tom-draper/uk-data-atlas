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
