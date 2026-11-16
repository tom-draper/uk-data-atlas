// GSS local authority codes use different prefixes in each nation. England's
// county councils are E10 codes, which the adult-social-care returns include.
export const authorityCode = (value: string) =>
	/^(?:E(?:0[6789])|W06|S12|N09)\d{6}$/.test(value);

// These two authorities are published on superseded codes in these releases.
// No official concordance accompanies the files, so they stay absent rather
// than being silently placed on a different current-boundary area.
const SUPERSEDED_LOCAL_AUTHORITY_CODES = new Set(["E08000016", "E08000019"]);
export const mapAuthorityCode = (code: string) =>
	authorityCode(code) && !SUPERSEDED_LOCAL_AUTHORITY_CODES.has(code);
