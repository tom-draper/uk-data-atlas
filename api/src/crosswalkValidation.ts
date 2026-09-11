import type { AreaLookup } from "./areaInventory";

export type CrosswalkEndpointValidation =
	| {
			status: "verified";
			availableAreaCount: number;
			referencedCodeCount: number;
	  }
	| { status: "not-available"; reason: string };

export const validateEndpoint = (
	crosswalkId: string,
	side: "from" | "to",
	endpoint: { geography: string; boundaryRelease: string },
	codes: Set<string>,
	areaLookup: AreaLookup | undefined,
): CrosswalkEndpointValidation => {
	const identity = `${endpoint.geography}/${endpoint.boundaryRelease}`;
	const areas = areaLookup?.get(identity);
	if (!areas) {
		return {
			status: "not-available",
			reason: `No compiled area release is available for ${identity}.`,
		};
	}
	const missing = [...codes].filter((code) => !areas.has(code));
	if (missing.length > 0) {
		throw new Error(
			`${crosswalkId}: ${side} references ${missing.length} code${
				missing.length === 1 ? "" : "s"
			} absent from ${identity}: ${missing.slice(0, 10).join(", ")}`,
		);
	}
	return {
		status: "verified",
		availableAreaCount: areas.size,
		referencedCodeCount: codes.size,
	};
};
