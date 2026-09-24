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
	"itl1",
	"itl2",
	"itl3",
	"localAuthority",
	"localPlanningAuthority",
	"lsoa",
	"msoa",
	"parish",
	"policeForceArea",
	"region",
	"scottishParliamentaryConstituency",
	"scottishParliamentaryRegion",
	"seneddConstituency",
	"seneddElectoralRegion",
	"subIntegratedCareBoardLocation",
	"superOutputArea",
	"ward",
] as const;

export type GeographyKind = (typeof GEOGRAPHY_KINDS)[number];

export const isGeographyKind = (value: unknown): value is GeographyKind =>
	typeof value === "string" && GEOGRAPHY_KINDS.some((kind) => kind === value);

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
