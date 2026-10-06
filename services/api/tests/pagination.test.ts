import assert from "node:assert/strict";
import test from "node:test";
import { cursorFor, paginate, readCursor } from "../src/pagination";

const items = ["a", "b", "c"].map((id) => ({ id }));
const pageOf = (query: string, subject = "letter query") =>
	paginate(new URL(`http://localhost/v1/letters?${query}`), items, {
		keyOf: (item) => item.id,
		subject,
	});

test("pages through items after the one each cursor names", () => {
	assert.deepEqual(pageOf("limit=2"), {
		items: [{ id: "a" }, { id: "b" }],
		nextCursor: cursorFor("b"),
	});
	assert.deepEqual(pageOf(`limit=2&cursor=${cursorFor("b")}`), {
		items: [{ id: "c" }],
		nextCursor: null,
	});
	assert.deepEqual(pageOf("limit=3"), { items, nextCursor: null });
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
				`http://localhost/v1/letters?limit=1&cursor=${cursorFor("a")}`,
			),
			view,
			{ keyOf: (item) => item.id, subject: "letter query" },
		),
		{ items: [{ id: "b" }], nextCursor: cursorFor("b") },
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
		detail(pageOf(`cursor=${cursorFor("z")}`, "house-price query"))!.detail,
		"cursor is not valid for this house-price query.",
	);
});

test("treats an empty cursor as none", () => {
	assert.deepEqual(
		readCursor(new URL("http://localhost/v1/letters?cursor=")),
		{},
	);
});
