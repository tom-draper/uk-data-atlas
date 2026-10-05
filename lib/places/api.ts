import type { AreaProfile, NamedProfile } from "@/lib/places/profile";

/**
 * The API requests that answer each part of a place page, with the docs page
 * for each. Ward pages render on demand, so the docs links are fixed here
 * rather than read from the contract while rendering; tests/places checks
 * them against it.
 */
export const PLACE_OPERATIONS = {
	getArea: "/docs/v1/reference/geography/area",
	getAreaHistory: "/docs/v1/reference/geography/area-history",
	getAreaParents: "/docs/v1/reference/geography/area-parents",
	getAreaChildren: "/docs/v1/reference/geography/area-children",
	getAreaNeighbours: "/docs/v1/reference/map/area-neighbours",
	getAreaGeometry: "/docs/v1/reference/map/area-geometry",
	getAreaCapabilities: "/docs/v1/reference/start-here/area-capabilities",
	getNamedLocation: "/docs/v1/reference/geography/named-location",
	getNamedLocationMembers:
		"/docs/v1/reference/geography/named-location-members",
} as const;

export type PlaceRequest = {
	operationId: keyof typeof PLACE_OPERATIONS;
	/** What the answer gives, in a few words. */
	label: string;
	path: string;
};

export function areaRequests(
	profile: AreaProfile,
	release: string,
): PlaceRequest[] {
	const base = `/v1/areas/${profile.geography}/${release}/${profile.code}`;
	return [
		{ operationId: "getArea", label: "The area", path: base },
		{
			operationId: "getAreaGeometry",
			label: "Its boundary",
			path: `${base}/geometry?tier=medium`,
		},
		{
			operationId: "getAreaHistory",
			label: "Its history",
			path: `${base}/history`,
		},
		{
			operationId: "getAreaParents",
			label: "What it sits within",
			path: `${base}/parents`,
		},
		{
			operationId: "getAreaChildren",
			label: "What it contains",
			path: `${base}/children`,
		},
		{
			operationId: "getAreaNeighbours",
			label: "Its neighbours",
			path: `${base}/neighbours`,
		},
		{
			operationId: "getAreaCapabilities",
			label: "What you can ask about it",
			path: `${base}/capabilities`,
		},
	];
}

export function namedRequests(profile: NamedProfile): PlaceRequest[] {
	return [
		{
			operationId: "getNamedLocation",
			label: "The place and its definition",
			path: `/v1/locations/${profile.id}`,
		},
		{
			operationId: "getNamedLocationMembers",
			label: "Its member councils",
			path: `/v1/locations/${profile.id}/members`,
		},
	];
}
