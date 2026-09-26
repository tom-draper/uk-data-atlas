/**
 * An unambiguous private key for an in-memory cache. Cache keys are not public
 * identifiers, so preserve their structure instead of inventing delimiters.
 */
export function cacheKey(...parts: readonly unknown[]): string {
	return JSON.stringify(parts);
}
