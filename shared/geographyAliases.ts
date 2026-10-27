import { GEOGRAPHY_KINDS, type GeographyKind } from "./geography";

/**
 * Familiar ONS/GSS abbreviations accepted at the API boundary. Responses and
 * links always use the more descriptive published geography identifiers.
 */
const GEOGRAPHY_ALIASES: Readonly<Record<string, GeographyKind>> = {
	ca: "combinedAuthority",
	csp: "communitySafetyPartnership",
	ctyua: "countyAndUnitaryAuthority",
	ced: "countyElectoralDivision",
	dz: "dataZone",
	fra: "fireAndRescueAuthority",
	icb: "integratedCareBoard",
	iz: "intermediateZone",
	lad: "localAuthority",
	lhb: "localHealthBoard",
	lpa: "localPlanningAuthority",
	mtc: "majorTownAndCity",
	natpark: "nationalPark",
	nhser: "nhsEnglandRegion",
	oa: "outputArea",
	par: "parish",
	pcon: "constituency",
	pfa: "policeForceArea",
	rgn: "region",
	sicbl: "subIntegratedCareBoardLocation",
	soa: "superOutputArea",
	spc: "scottishParliamentaryConstituency",
	spr: "scottishParliamentaryRegion",
	senc: "seneddConstituency",
	senr: "seneddElectoralRegion",
	ttwa: "travelToWorkArea",
	wd: "ward",
};

/** The canonical geography named by a public identifier or common abbreviation. */
export const canonicalGeography = (value: string): GeographyKind | undefined =>
	GEOGRAPHY_KINDS.find(
		(kind) => kind.toLowerCase() === value.toLowerCase(),
	) ?? GEOGRAPHY_ALIASES[value.toLowerCase()];
