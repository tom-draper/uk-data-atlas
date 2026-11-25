import assert from "node:assert/strict";
import { test } from "vitest";
import {
	cursorFor,
	cursorScope,
	paginate,
	readCursor,
} from "../src/http/pagination";

const items = ["a", "b", "c"].map((id) => ({ id }));
const scope = cursorScope("release-a", ["v1", "letters"], "asc");
const pageOf = (query: string, subject = "letter query") =>
	paginate(new URL(`http://localhost/v1/letters?${query}`), items, {
		keyOf: (item) => item.id,
		subject,
		scope,
	});

test("pages through items after the one each cursor names", () => {
	assert.deepEqual(pageOf("limit=2"), {
		items: [{ id: "a" }, { id: "b" }],
		nextCursor: cursorFor(scope, "b"),
	});
	assert.deepEqual(pageOf(`limit=1&cursor=${cursorFor(scope, "b")}`), {
		items: [{ id: "c" }],
		nextCursor: null,
	});
	assert.deepEqual(pageOf("limit=3"), { items, nextCursor: null });
});

test("cursors cannot be reused for another release, resource or selection", () => {
	const page = (scope: string, cursor?: string) =>
		paginate(
			new URL(
				`http://localhost/v1/letters?limit=1${cursor ? `&cursor=${cursor}` : ""}`,
			),
			items,
			{ keyOf: (item) => item.id, subject: "letter query", scope },
		);
	const first = page(scope);
	assert.ok(!("problem" in first) && first.nextCursor);
	assert.deepEqual(page(scope, first.nextCursor), {
		items: [{ id: "b" }],
		nextCursor: cursorFor(scope, "b"),
	});
	for (const result of [
		page(
			cursorScope("release-b", ["v1", "letters"], "asc"),
			first.nextCursor,
		),
		page(
			cursorScope("release-a", ["v1", "words"], "asc"),
			first.nextCursor,
		),
		page(
			cursorScope("release-a", ["v1", "letters"], "desc"),
			first.nextCursor,
		),
		page(scope, Buffer.from("a").toString("base64url")),
		page(
			scope,
			Buffer.from(JSON.stringify(["series-a", "a"])).toString(
				"base64url",
			),
		),
	]) {
		assert.ok("problem" in result);
		assert.equal(result.problem.status, 400);
		assert.equal(
			(result.problem.body as { code?: string }).code,
			"invalid_cursor",
		);
		assert.match(
			(result.problem.body as { detail: string }).detail,
			/Restart pagination/,
		);
	}
});

test("asks a view with an index where a cursor falls", () => {
	const view = {
		length: items.length,
		slice: (start: number, end: number) => items.slice(start, end),
		positionOf: (key: string) => (key === "a" ? 0 : -1),
	};
	assert.deepEqual(
		paginate(
			new URL(
				`http://localhost/v1/letters?limit=1&cursor=${cursorFor(scope, "a")}`,
			),
			view,
			{ keyOf: (item) => item.id, subject: "letter query", scope },
		),
		{ items: [{ id: "b" }], nextCursor: cursorFor(scope, "b") },
	);
});

test("refuses a limit out of range and a cursor it did not issue or cannot place", () => {
	const detail = (page: ReturnType<typeof pageOf>) =>
		"problem" in page
			? (page.problem.body as { detail: string; code?: string })
			: undefined;
	assert.match(detail(pageOf("limit=0"))!.detail, /^limit must be/);
	const invalid = detail(pageOf("cursor=not-a-cursor"))!;
	assert.equal(invalid.detail, "cursor is invalid.");
	assert.equal(invalid.code, "invalid_cursor");
	assert.equal(
		detail(pageOf(`cursor=${cursorFor(scope, "z")}`, "house-price query"))!
			.detail,
		"cursor is not valid for this house-price query.",
	);
});

test("treats an empty cursor as none", () => {
	assert.deepEqual(
		readCursor(new URL("http://localhost/v1/letters?cursor="), scope),
		{},
	);
});
