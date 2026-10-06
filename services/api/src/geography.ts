/** Geography identifiers used by published UK Data Atlas boundary releases. */
export const GEOGRAPHY_KINDS = [
	"combinedAuthority",
	"communitySafetyPartnership",
	"constituency",
	"country",
	"countyAndUnitaryAuthority",
	"countyElectoralDivision",
	"dataZone",
	"fireAndRescueAuthority",
	"integratedCareBoard",
	"intermediateZone",
	"itl1",
	"itl2",
	"itl3",
	"localAuthority",
	"localHealthBoard",
	"localPlanningAuthority",
	"lsoa",
	"majorTownAndCity",
	"msoa",
	"nationalPark",
	"nhsEnglandRegion",
	"outputArea",
	"parish",
	"policeForceArea",
	"region",
	"scottishParliamentaryConstituency",
	"scottishParliamentaryRegion",
	"seneddConstituency",
	"seneddElectoralRegion",
	"subIntegratedCareBoardLocation",
	"superOutputArea",
	"travelToWorkArea",
	"ward",
] as const;

export type GeographyKind = (typeof GEOGRAPHY_KINDS)[number];

export const isGeographyKind = (value: unknown): value is GeographyKind =>
	typeof value === "string" && GEOGRAPHY_KINDS.some((kind) => kind === value);

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

/** Geographies currently supported for source-exact measure partitions. */
export type MeasureGeographyKind =
	| "communitySafetyPartnership"
	| "constituency"
	| "dataZone"
	| "itl1"
	| "itl2"
	| "itl3"
	| "localAuthority"
	| "localPlanningAuthority"
	| "lsoa"
	| "msoa"
	| "superOutputArea"
	| "ward";
