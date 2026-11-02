/**
 * Salford's wards were redrawn in 2021. The workbook still publishes them under
 * their old codes, so they are moved onto the new ones for the map to join. The
 * old code is kept on the record as `sourceWardCode`, because a price measured
 * on the old ward is not a price for the new one and the API serves it under
 * the code it was published against.
 */
export const SALFORD_WARD_CODE_REMAP: Record<string, string> = {
	E05000759: "E05013018",
	E05000760: "E05013020",
	E05000761: "E05013021",
	E05000762: "E05013022",
	E05000763: "E05013023",
	E05000764: "E05013024",
	E05000765: "E05013025",
	E05000766: "E05013019",
	E05000767: "E05013026",
	E05000768: "E05013030",
	E05000769: "E05013027",
	E05000770: "E05013028",
	E05000771: "E05013029",
	E05000772: "E05013032",
	E05000773: "E05013033",
	E05000774: "E05013034",
	E05000775: "E05013035",
	E05000776: "E05013036",
	E05000777: "E05013031",
	E05000778: "E05013037",
};

/**
 * A code-only repair is safe only where the official geometries are identical.
 * Temple Newsam's December 2020 and December 2021 ward geometries are
 * identical, while Garforth & Swillington's are not and must stay on the
 * publisher's later code.
 */
export const HOUSE_PRICE_SERVED_WARD_CODES: ReadonlyMap<string, string> =
	new Map([
		["E05013831", "E05011412"], // Temple Newsam, December 2021 -> December 2020
	]);
