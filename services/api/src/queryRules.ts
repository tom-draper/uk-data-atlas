// Generated from openapi.yaml by `pnpm build:query-rules`. Do not edit.

export const QUERY_RULES = {
	"GET /map-resources/{geography}/{release}/features": {
		tier: {
			values: ["full", "high", "medium", "low"],
		},
		format: {
			values: ["geoparquet", "geojson"],
			default: "geoparquet",
		},
	},
	"GET /map-resources/{geography}/{release}/join/{measure-id}": {
		format: {
			values: ["json", "parquet"],
			default: "json",
		},
	},
	"GET /boundary-releases:resolve": {
		country: {
			values: ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"],
		},
	},
	"GET /boundary-releases:compare": {
		limit: {
			minimum: 1,
			maximum: 100,
			default: 25,
		},
	},
	"POST /boundary-releases/{geography}/{release}:join": {
		format: {
			values: ["json", "geojson"],
			default: "json",
		},
		tier: {
			values: ["full", "high", "medium", "low"],
			default: "medium",
		},
	},
	"GET /terrain/elevation/point": {
		interpolation: {
			values: ["bilinear", "nearest"],
			default: "bilinear",
		},
	},
	"GET /coordinates:convert": {
		crs: {
			values: ["EPSG:4326", "EPSG:27700", "EPSG:29902"],
			default: "EPSG:4326",
		},
		to: {
			values: ["EPSG:4326", "EPSG:27700", "EPSG:29902"],
			default: "EPSG:4326",
		},
		gridrefDigits: {
			minimum: 1,
			maximum: 5,
			default: 5,
		},
	},
	"GET /data/{measure-id}": {
		geography: {
			values: [
				"ward",
				"localAuthority",
				"constituency",
				"lsoa",
				"msoa",
				"dataZone",
				"superOutputArea",
			],
		},
		include: {
			values: ["area"],
		},
		format: {
			values: ["json", "csv", "ndjson"],
			default: "json",
		},
		units: {
			values: ["source", "canonical"],
			default: "source",
		},
		limit: {
			minimum: 1,
			maximum: 500,
			default: 100,
		},
	},
	"GET /data/{measure-id}/convert": {
		geography: {
			values: [
				"ward",
				"localAuthority",
				"constituency",
				"lsoa",
				"msoa",
				"dataZone",
				"superOutputArea",
			],
		},
		limit: {
			minimum: 1,
			maximum: 500,
			default: 100,
		},
	},
	"GET /data/{measure-id}/series": {
		geography: {
			values: [
				"ward",
				"localAuthority",
				"constituency",
				"lsoa",
				"msoa",
				"dataZone",
				"superOutputArea",
			],
		},
	},
	"GET /data/{measure-id}/rankings": {
		geography: {
			values: [
				"ward",
				"localAuthority",
				"constituency",
				"lsoa",
				"msoa",
				"dataZone",
				"superOutputArea",
			],
		},
		order: {
			values: ["asc", "desc"],
			default: "desc",
		},
		limit: {
			minimum: 1,
			maximum: 500,
			default: 100,
		},
	},
	"GET /places": {
		limit: {
			minimum: 1,
			maximum: 500,
			default: 10,
		},
		country: {
			values: ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"],
		},
	},
	"GET /postcodes/{postcode}": {
		view: {
			values: ["full", "compact"],
			default: "full",
		},
	},
	"POST /postcodes:batch": {
		view: {
			values: ["full", "compact"],
			default: "full",
		},
	},
	"GET /data/{measure-id}/change": {
		by: {
			values: ["absolute", "relative"],
			default: "absolute",
		},
		order: {
			values: ["asc", "desc"],
			default: "desc",
		},
		limit: {
			minimum: 1,
			maximum: 500,
			default: 100,
		},
	},
	"GET /data/{measure-id}/compare": {
		geography: {
			values: [
				"ward",
				"localAuthority",
				"constituency",
				"lsoa",
				"msoa",
				"dataZone",
				"superOutputArea",
			],
		},
	},
	"GET /areas": {
		limit: {
			minimum: 1,
			maximum: 500,
			default: 100,
		},
	},
	"GET /areas:intersects": {
		tier: {
			values: ["full", "high", "medium", "low"],
		},
		limit: {
			minimum: 1,
			maximum: 1000,
			default: 200,
		},
	},
	"GET /areas:validate": {
		format: {
			values: ["json", "csv"],
			default: "json",
		},
	},
	"GET /areas:contains": {
		crs: {
			values: ["EPSG:4326", "EPSG:27700", "EPSG:29902"],
			default: "EPSG:4326",
		},
	},
	"POST /areas:containsBatch": {
		crs: {
			values: ["EPSG:4326", "EPSG:27700", "EPSG:29902"],
			default: "EPSG:4326",
		},
	},
	"GET /areas:near": {
		crs: {
			values: ["EPSG:4326", "EPSG:27700", "EPSG:29902"],
			default: "EPSG:4326",
		},
		limit: {
			minimum: 1,
			maximum: 10,
			default: 1,
		},
		within: {
			minimum: 1,
			maximum: 50000,
			default: 1000,
		},
	},
	"GET /areas/{geography}/{release}/{code}/history": {
		depth: {
			minimum: 1,
			maximum: 20,
			default: 8,
		},
	},
	"GET /areas/{geography}/{release}/{code}/parents": {
		depth: {
			minimum: 1,
			maximum: 20,
		},
	},
	"GET /areas/{geography}/{release}/{code}/children": {
		depth: {
			minimum: 1,
			maximum: 20,
		},
	},
	"GET /areas/{geography}/{release}/{code}/children/geometry": {
		tier: {
			values: ["full", "high", "medium", "low"],
			default: "full",
		},
	},
	"GET /areas/{geography}/{release}/{code}/neighbours": {
		touches: {
			values: ["edge", "any"],
			default: "edge",
		},
	},
	"GET /areas/{geography}/{release}/{code}/geometry": {
		tier: {
			values: ["full", "high", "medium", "low"],
			default: "full",
		},
	},
	"GET /relationships": {
		purpose: {
			values: ["identity", "membership", "apportion"],
			default: "membership",
		},
		operation: {
			values: [
				"identity-join",
				"code-translation",
				"containment-aggregation",
				"membership-join",
				"weighted-allocation",
			],
		},
		relation: {
			values: [
				"within",
				"contains",
				"successor",
				"predecessor",
				"split-from",
				"merged-from",
				"equivalent-to",
				"overlaps",
			],
		},
		limit: {
			minimum: 1,
			maximum: 100,
			default: 25,
		},
	},
	"GET /crosswalks/{crosswalk-id}/records": {
		limit: {
			minimum: 1,
			maximum: 500,
			default: 100,
		},
	},
	"GET /lookups/{lookup-id}": {
		format: {
			values: ["csv", "ndjson"],
			default: "csv",
		},
	},
	"GET /translations": {
		purpose: {
			values: ["identity", "membership", "apportion"],
			default: "membership",
		},
	},
	"GET /locations": {
		limit: {
			minimum: 1,
			maximum: 500,
			default: 100,
		},
	},
} as const;
