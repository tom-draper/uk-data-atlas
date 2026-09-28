/** Limits and cursors shared by every paginated resource. */
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 500;

/** A `limit` query value, or undefined when it is not a whole number in range. */
export const readPageSize = (
	value: string | null,
	fallback = DEFAULT_PAGE_SIZE,
): number | undefined => {
	if (value === null) return fallback;
	if (!/^[1-9]\d*$/.test(value)) return undefined;
	const size = Number(value);
	return size <= MAX_PAGE_SIZE ? size : undefined;
};

/** An opaque cursor naming the last item of a page. */
export const cursorFor = (key: string) =>
	Buffer.from(key).toString("base64url");

/** The key a cursor names, or undefined when it is not one this API issued. */
export const keyFromCursor = (cursor: string): string | undefined => {
	try {
		const key = Buffer.from(cursor, "base64url").toString("utf8");
		return key.length > 0 && cursorFor(key) === cursor ? key : undefined;
	} catch {
		return undefined;
	}
};

/** The same query with the cursor advanced, as a relative `Link` target. */
export const nextPageHref = (parsedUrl: URL, nextCursor: string) => {
	const params = new URLSearchParams(parsedUrl.searchParams);
	params.set("cursor", nextCursor);
	return `${parsedUrl.pathname}?${params.toString()}`;
};
