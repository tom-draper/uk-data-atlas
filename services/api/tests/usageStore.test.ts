import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import type { UsageEvent } from "../src/usageLabels";
import { UsageRecorder } from "../src/usageRecorder";
import { usageReport } from "../src/usageReport";
import { UsageStore, type UsageRow } from "../src/usageStore";

const directory = (t: TestContext) => {
	const path = mkdtempSync(join(tmpdir(), "usage-"));
	t.after(() => rmSync(path, { recursive: true, force: true }));
	return path;
};

const event = (overrides: Partial<UsageEvent> = {}): UsageEvent => ({
	route: "/v1/data/{measure-id}",
	outcome: "2xx",
	problem: "",
	measure: "population",
	geography: "",
	release: "",
	notFound: "",
	...overrides,
});

const DAY_ONE = Date.UTC(2026, 9, 1, 12);
const DAY_TWO = Date.UTC(2026, 9, 2, 12);

const requests = (store: UsageStore, since = "2026-10-01") =>
	store.totals(since, ["measure"], { present: ["measure"] });

test("writes nothing to disk until a flush", (t) => {
	const path = directory(t);
	const recorder = new UsageRecorder(UsageStore.open(path), {
		now: () => DAY_ONE,
	});
	for (let index = 0; index < 500; index++) recorder.record(event());
	const reader = UsageStore.openReadOnly(path);
	t.after(() => reader.close());
	assert.deepEqual(requests(reader), []);
	recorder.flush();
	assert.deepEqual(requests(reader), [
		{ measure: "population", requests: 500, failed: 0 },
	]);
	recorder.close();
});

test("sums what several workers write to the same file", (t) => {
	const path = directory(t);
	// Each worker is its own process with its own handle on the file.
	const workers = [0, 1, 2].map(
		() => new UsageRecorder(UsageStore.open(path), { now: () => DAY_ONE }),
	);
	workers.forEach((worker, index) => {
		for (let count = 0; count <= index; count++) worker.record(event());
		worker.record(event({ measure: "unknown", outcome: "4xx" }));
	});
	// Flush in an order unrelated to the order the requests arrived.
	[2, 0, 1].forEach((index) => workers[index]!.flush());
	const reader = UsageStore.openReadOnly(path);
	t.after(() => reader.close());
	assert.deepEqual(requests(reader), [
		{ measure: "population", requests: 6, failed: 0 },
		{ measure: "unknown", requests: 3, failed: 3 },
	]);
	workers.forEach((worker) => worker.close());
});

test("keeps counts across a restart and adds to them", (t) => {
	const path = directory(t);
	const first = new UsageRecorder(UsageStore.open(path), {
		now: () => DAY_ONE,
	});
	first.record(event());
	first.record(event());
	first.close();

	const second = new UsageRecorder(UsageStore.open(path), {
		now: () => DAY_ONE,
	});
	second.record(event());
	second.close();

	const reader = UsageStore.openReadOnly(path);
	t.after(() => reader.close());
	assert.deepEqual(requests(reader), [
		{ measure: "population", requests: 3, failed: 0 },
	]);
});

test("keeps each UTC day apart and reads a window of days", (t) => {
	const path = directory(t);
	let now = DAY_ONE;
	const recorder = new UsageRecorder(UsageStore.open(path), {
		now: () => now,
	});
	recorder.record(event());
	now = DAY_TWO;
	recorder.record(event());
	recorder.record(event());
	recorder.close();

	const reader = UsageStore.openReadOnly(path);
	t.after(() => reader.close());
	assert.equal(requests(reader, "2026-10-01")[0]!.requests, 3);
	assert.equal(requests(reader, "2026-10-02")[0]!.requests, 2);
	assert.deepEqual(requests(reader, "2026-10-03"), []);
});

test("keeps counts whose write failed for the next flush", (t) => {
	const path = directory(t);
	const store = UsageStore.open(path);
	let failing = true;
	const errors: unknown[] = [];
	const flaky = Object.assign(Object.create(store), {
		add: (rows: readonly UsageRow[]) => {
			if (failing) throw new Error("database is locked");
			store.add(rows);
		},
		close: () => store.close(),
	}) as UsageStore;
	const recorder = new UsageRecorder(flaky, {
		now: () => DAY_ONE,
		onError: (error) => errors.push(error),
	});
	recorder.record(event());
	recorder.flush();
	recorder.record(event());
	failing = false;
	recorder.close();
	assert.equal(errors.length, 1);
	const reader = UsageStore.openReadOnly(path);
	t.after(() => reader.close());
	assert.equal(requests(reader)[0]!.requests, 2);
});

test("bounds the buffer and counts what it had to drop", (t) => {
	const path = directory(t);
	const recorder = new UsageRecorder(UsageStore.open(path), {
		maxKeys: 2,
		now: () => DAY_ONE,
	});
	for (const measure of ["a", "b", "c", "d"])
		recorder.record(event({ measure }));
	recorder.record(event({ measure: "a" }));
	assert.equal(recorder.dropped, 2);
	recorder.close();
	const reader = UsageStore.openReadOnly(path);
	t.after(() => reader.close());
	assert.deepEqual(
		requests(reader).map(({ measure, requests }) => [measure, requests]),
		[
			["a", 2],
			["b", 1],
		],
	);
});

test("stores a label that is not an id or template as other", (t) => {
	const path = directory(t);
	const store = UsageStore.open(path);
	t.after(() => store.close());
	store.add([
		{
			...event({ measure: "SW1A 1AA", geography: "10 Downing Street" }),
			day: "2026-10-01",
			requests: 1,
		},
	]);
	const [row] = store.totals("2026-10-01", ["measure", "geography"]);
	assert.equal(row!.measure, "other");
	assert.equal(row!.geography, "other");
});

test("forgets days before the retention window", (t) => {
	const path = directory(t);
	const store = UsageStore.open(path);
	t.after(() => store.close());
	const row = { ...event(), requests: 1 };
	store.add([
		{ ...row, day: "2026-09-01" },
		{ ...row, day: "2026-10-01" },
	]);
	store.prune("2026-10-01");
	assert.equal(requests(store, "2026-01-01")[0]!.requests, 1);
});

test("reports the top routes, measures, areas and not-found requests", (t) => {
	const path = directory(t);
	const store = UsageStore.open(path);
	t.after(() => store.close());
	const rows = (
		overrides: Partial<UsageEvent>,
		requests: number,
		day = "2026-10-02",
	): UsageRow => ({ ...event(overrides), day, requests });
	store.add([
		rows({ measure: "population" }, 40),
		rows({ measure: "median-age" }, 10),
		rows(
			{
				measure: "unknown",
				outcome: "4xx",
				problem: "not-found",
				notFound: "unknown-measure",
			},
			7,
		),
		rows(
			{
				route: "/v1/areas/{geography}/{release}/{code}",
				measure: "",
				geography: "ward",
				release: "2025-01-en-ward",
			},
			25,
		),
		rows(
			{
				route: "/v1/areas/{geography}/{release}/{code}",
				measure: "",
				geography: "ward",
				release: "unknown",
				outcome: "4xx",
				problem: "unknown_release",
				notFound: "unknown-release",
			},
			3,
		),
		rows({ measure: "population" }, 999, "2026-08-01"),
	]);
	const text = usageReport(store, {
		days: 30,
		limit: 5,
		now: Date.UTC(2026, 9, 5),
	});
	assert.match(
		text,
		/from 2026-09-06 to 2026-10-05 \(UTC\), 85 requests, 10 failed/,
	);
	const section = (title: string) =>
		text.split("\n\n").find((block) => block.startsWith(title))!;
	// The old day is outside the window, and routes are ranked by count.
	assert.match(
		section("Top routes"),
		/\n\s*57\s+7\s+\/v1\/data\/\{measure-id\}/,
	);
	assert.match(
		section("Top measures"),
		/\n\s*40\s+0\s+population\n\s*10\s+0\s+median-age\n\s*7\s+7\s+unknown/,
	);
	assert.match(
		section("Top geographies"),
		/25\s+0\s+ward\s+2025-01-en-ward\n\s*3\s+3\s+ward\s+unknown/,
	);
	assert.match(
		section("Top not found"),
		/7\s+7\s+unknown-measure\s+\/v1\/data\/\{measure-id\}\s+unknown/,
	);
	assert.match(section("Top not found"), /3\s+3\s+unknown-release/);
	assert.doesNotMatch(section("Top measures"), /999/);
});

test("says so when nothing has been recorded", (t) => {
	const store = UsageStore.open(directory(t));
	t.after(() => store.close());
	const text = usageReport(store, { days: 7, limit: 5, now: DAY_ONE });
	assert.match(text, /0 requests, 0 failed/);
	assert.equal(text.match(/\n {2}none/g)?.length, 4);
});
