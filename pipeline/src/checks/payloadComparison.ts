/**
 * Whether two dataset payloads hold the same values. Numbers equal to within
 * a relative 1e-9 count as equal, so an average summed in another order is
 * the same value. Everything else, including nulls and absent keys, must
 * match exactly.
 */
export const payloadValuesEqual = (left: unknown, right: unknown): boolean =>
	payloadDifference(left, right) === undefined;

/** The first path at which two payloads differ, with both values. */
export function payloadDifference(
	left: unknown,
	right: unknown,
	path: string[] = [],
): string | undefined {
	if (typeof left === "number" && typeof right === "number") {
		const scale = Math.max(1, Math.abs(left), Math.abs(right));
		return left === right || Math.abs(left - right) <= scale * 1e-9
			? undefined
			: describe(left, right, path);
	}
	if (
		left !== null &&
		right !== null &&
		typeof left === "object" &&
		typeof right === "object" &&
		Array.isArray(left) === Array.isArray(right)
	) {
		const a = left as Record<string, unknown>;
		const b = right as Record<string, unknown>;
		for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
			if (!(key in a) || !(key in b))
				return describe(a[key], b[key], [...path, key]);
			const found = payloadDifference(a[key], b[key], [...path, key]);
			if (found) return found;
		}
		return undefined;
	}
	return left === right ? undefined : describe(left, right, path);
}

const describe = (left: unknown, right: unknown, path: string[]) =>
	`${path.join(".")}: got ${JSON.stringify(left)?.slice(0, 200)} want ${JSON.stringify(right)?.slice(0, 200)}`;
