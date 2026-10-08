import { invalidQuery, type ApiResponse } from "./routeResponse";

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

const invalidCursor = (detail: string) =>
	invalidQuery(detail, { code: "invalid_cursor" });

/**
 * The key named by the request's `cursor`, none when it has no cursor, or the
 * refusal of a cursor this API did not issue.
 */
export const readCursor = (
	parsedUrl: URL,
): { key?: string } | { problem: ApiResponse } => {
	const cursor = parsedUrl.searchParams.get("cursor");
	if (!cursor) return {};
	const key = keyFromCursor(cursor);
	return key === undefined
		? { problem: invalidCursor("cursor is invalid.") }
		: { key };
};

/**
 * Items read a page at a time. An array is searched for a cursor's key; a
 * view with an index says where the key falls itself.
 */
export type Pageable<T> =
	| readonly T[]
	| {
			length: number;
			slice(start: number, end: number): T[];
			/** Where the item with this key falls, or -1. */
			positionOf(key: string): number;
	  };

export type Page<T> = { items: T[]; nextCursor: string | null };

/**
 * The page of `items` that the request's `limit` and `cursor` select. Each
 * cursor names the key of the last item of the page before, so a client
 * resumes after that item.
 */
export const paginate = <T>(
	parsedUrl: URL,
	items: Pageable<T>,
	options: {
		keyOf: (item: T) => string;
		/** What is paged, such as `ranking`, for a cursor that names none of it. */
		subject: string;
	},
): Page<T> | { problem: ApiResponse } => {
	const pageSize = readPageSize(parsedUrl.searchParams.get("limit"));
	if (pageSize === undefined)
		return {
			problem: invalidQuery(
				`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`,
			),
		};
	const cursor = readCursor(parsedUrl);
	if ("problem" in cursor) return cursor;
	const { key } = cursor;
	const offset =
		key === undefined
			? 0
			: ("positionOf" in items
					? items.positionOf(key)
					: items.findIndex((item) => options.keyOf(item) === key)) +
				1;
	if (key !== undefined && offset === 0)
		return {
			problem: invalidCursor(
				`cursor is not valid for this ${options.subject}.`,
			),
		};
	const page = items.slice(offset, offset + pageSize);
	const last = page.at(-1);
	return {
		items: page,
		nextCursor:
			offset + page.length < items.length && last !== undefined
				? cursorFor(options.keyOf(last))
				: null,
	};
};
