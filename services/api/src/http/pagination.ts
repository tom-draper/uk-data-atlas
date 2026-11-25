import { createHash } from "node:crypto";
import { invalidQuery, type ApiResponse } from "../runtime/index.ts";

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

/** Identifies the release, resource and resolved selection of a paginated query. */
export const cursorScope = (
	releaseId: string,
	resource: readonly string[],
	...selection: (string | number | null | undefined)[]
) =>
	createHash("sha256")
		.update(JSON.stringify([releaseId, resource, selection]))
		.digest("base64url");

const encodeCursor = (value: string) =>
	Buffer.from(value).toString("base64url");

/** An opaque cursor naming the last item of a page within its query. */
export const cursorFor = (scope: string, key: string) =>
	encodeCursor(JSON.stringify([1, scope, key]));

const decodeCursor = (cursor: string): string | undefined => {
	try {
		const key = Buffer.from(cursor, "base64url").toString("utf8");
		return key.length > 0 && encodeCursor(key) === cursor ? key : undefined;
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

export const mismatchedCursor = () =>
	invalidCursor(
		"cursor does not belong to this query or Atlas release. Restart pagination without a cursor.",
	);

/**
 * The key named by the request's `cursor`, none when it has no cursor, or the
 * refusal of a cursor this API did not issue.
 */
export const readCursor = (
	parsedUrl: URL,
	scope: string,
): { key?: string } | { problem: ApiResponse } => {
	const cursor = parsedUrl.searchParams.get("cursor");
	if (!cursor) return {};
	const payload = decodeCursor(cursor);
	if (payload === undefined)
		return { problem: invalidCursor("cursor is invalid.") };
	try {
		const decoded: unknown = JSON.parse(payload);
		if (
			Array.isArray(decoded) &&
			decoded.length === 3 &&
			decoded[0] === 1 &&
			decoded[1] === scope &&
			typeof decoded[2] === "string" &&
			decoded[2].length > 0
		)
			return { key: decoded[2] };
	} catch {}
	return { problem: mismatchedCursor() };
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
	source: Pageable<T> | (() => Pageable<T>),
	options: {
		keyOf: (item: T) => string;
		/** What is paged, such as `ranking`, for a cursor that names none of it. */
		subject: string;
		scope: string;
		/** Reads starting at the cursor's key, including the key itself. */
		readFrom?: (
			key: string | undefined,
			limit: number,
		) => readonly T[] | undefined;
	},
): Page<T> | { problem: ApiResponse } => {
	const pageSize = readPageSize(parsedUrl.searchParams.get("limit"));
	if (pageSize === undefined)
		return {
			problem: invalidQuery(
				`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`,
			),
		};
	const cursor = readCursor(parsedUrl, options.scope);
	if ("problem" in cursor) return cursor;
	const { key } = cursor;
	const invalidKey = () => ({
		problem: invalidCursor(
			`cursor is not valid for this ${options.subject}.`,
		),
	});
	const start = key === undefined ? 0 : 1;
	const bounded = options.readFrom?.(key, start + pageSize + 1);
	if (bounded) {
		if (start && (!bounded.length || options.keyOf(bounded[0]!) !== key))
			return invalidKey();
		const page = bounded.slice(start, start + pageSize);
		return {
			items: page,
			nextCursor:
				bounded.length > start + pageSize
					? cursorFor(
							options.scope,
							options.keyOf(page[pageSize - 1]!),
						)
					: null,
		};
	}
	const items = typeof source === "function" ? source() : source;
	const offset =
		key === undefined
			? 0
			: ("positionOf" in items
					? items.positionOf(key)
					: items.findIndex((item) => options.keyOf(item) === key)) +
				1;
	if (key !== undefined && offset === 0) return invalidKey();
	const page = items.slice(offset, offset + pageSize);
	const last = page.at(-1);
	return {
		items: page,
		nextCursor:
			offset + page.length < items.length && last !== undefined
				? cursorFor(options.scope, options.keyOf(last))
				: null,
	};
};
