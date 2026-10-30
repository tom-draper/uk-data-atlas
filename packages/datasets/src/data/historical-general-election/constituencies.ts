/**
 * The atlas code of a House of Commons Library constituency: its boundary
 * set's first year and the Library's id, which is only unique within a set
 * (`1918-1`). The few rows the Library gives no id are keyed by name, as
 * `1918-belfast-victoria`.
 */
export const historicalConstituencyCode = (boundarySet: string, id: string) =>
	`${boundarySet.split("-")[0]}-${id
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")}`;
