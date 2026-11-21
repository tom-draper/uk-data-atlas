/**
 * Trimming a catalogue payload to the entries the atlas reads.
 *
 * A payload is keyed by year (or by id, such as life expectancy's `le` and
 * `hle`). A value card reads one key, yet the whole history ships: 20 years of
 * greenhouse gas emissions is 594KB compressed where the card's year is 30KB.
 * The client asks for the keys it reads with `?keys=`, and the catalogue route
 * returns only those.
 */

const KEY = /^[A-Za-z0-9_-]{1,32}$/;
const MAX_KEYS = 16;

/** The requested keys, sorted, or `null` when the query is absent or invalid. */
export function parsePayloadKeys(value: string | null): string[] | null {
	if (!value) return null;
	const keys = [...new Set(value.split(","))];
	if (keys.length > MAX_KEYS || !keys.every((key) => KEY.test(key)))
		return null;
	return keys.sort();
}

/** The `keys` query value for a set of payload keys. */
export function payloadKeysQuery(keys: Iterable<string>): string {
	return [...new Set(keys)].sort().join(",");
}

/** The payload's entries named by `keys`, in the payload's order. */
export function pickPayloadEntries(
	payload: Record<string, unknown>,
	keys: readonly string[],
): Record<string, unknown> {
	const wanted = new Set(keys);
	return Object.fromEntries(
		Object.entries(payload).filter(([key]) => wanted.has(key)),
	);
}
