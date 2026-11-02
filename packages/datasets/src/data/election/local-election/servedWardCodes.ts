/**
 * LEAP source codes with the same official ward extent as the polling year's
 * release under the Atlas's published 99% overlap rule, as [source code,
 * served code]. Materially different boundaries deliberately remain on the
 * publisher's code. They apply to polls on boundaries before 2021; later
 * polls are already on codes their own release holds.
 */
export const SERVED_LOCAL_ELECTION_WARD_CODES: ReadonlyMap<string, string> =
	new Map([
		["E05011348", "E05010919"],
		["E05011349", "E05010920"],
		["E05012969", "E05010931"],
		["E05008537", "E05008939"],
		["W05000868", "W05001012"],
		["E05012841", "E05011382"],
		["E05012842", "E05011383"],
		["E05012647", "E05011386"],
		["E05012648", "E05011392"],
		["E05013830", "E05011393"],
		["E05013831", "E05011412"],
	]);

/** The boundary year from which polls need no served-code correction. */
export const SERVED_WARD_CODES_UNTIL = 2021;
