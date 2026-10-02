/** Stable composite keys shared by geography indexes and route identities. */
export const releaseKey = (geography: string, boundaryRelease: string) =>
	`${geography}/${boundaryRelease}`;

export const areaKey = (
	geography: string,
	boundaryRelease: string,
	code: string,
) => `${releaseKey(geography, boundaryRelease)}/${code}`;
