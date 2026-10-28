export const GEOMETRY_VALIDITY_METHOD = {
	validator: "jsts/IsValidOp",
	version: "2.12.1",
	coordinates: "WGS84-planar-XY",
	positionLimit: 10_000,
} as const;

export type GeometryValidityIssue = {
	code: string;
	message: string;
	coordinate?: [number, number];
};

export type GeometryValidityReport = {
	method: typeof GEOMETRY_VALIDITY_METHOD;
} & (
	| { status: "valid" }
	| { status: "invalid"; issue: GeometryValidityIssue }
	| {
			status: "not-checked";
			reason:
				| "not-compiled"
				| "position-limit"
				| "unsupported-geometry"
				| "validator-error";
	  }
);

export const uncompiledGeometryValidity: GeometryValidityReport = {
	method: GEOMETRY_VALIDITY_METHOD,
	status: "not-checked",
	reason: "not-compiled",
};
