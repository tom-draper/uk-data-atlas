import { afterEach, describe, expect, it, vi } from "vitest";
import {
	loadJsonDataset,
	loadJsonDatasetSlice,
} from "@/lib/data/jsonDatasetClient";

const parseDataset = (value: unknown) => {
	if (
		typeof value !== "object" ||
		value === null ||
		!("value" in value) ||
		typeof value.value !== "number"
	)
		throw new Error("Invalid test dataset record");
	return { value: value.value };
};

describe("json dataset client", () => {
	afterEach(() => vi.restoreAllMocks());

	it("falls back to fetch when workers are unavailable", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ E1: { value: 4 } }),
			}),
		);

		await expect(loadJsonDataset("/data/example.json")).resolves.toEqual({
			E1: { value: 4 },
		});
	});

	it("assembles enabled slices and records individual failures", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(async (url: string) => {
				if (url.endsWith("broken.json"))
					return {
						ok: false,
						status: 503,
						statusText: "Unavailable",
					};
				return { ok: true, json: async () => ({ E1: { value: 4 } }) };
			}),
		);

		await expect(
			loadJsonDatasetSlice(
				[
					{ key: "good", url: "/good.json", enabled: true },
					{ key: "disabled", url: "/disabled.json", enabled: false },
					{ key: "broken", url: "/broken.json", enabled: true },
				],
				new AbortController().signal,
				parseDataset,
			),
		).resolves.toEqual({
			datasets: { good: { E1: { value: 4 } } },
			errors: ["Failed to fetch /broken.json: 503 Unavailable"],
		});
	});

	it("limits concurrent requests while starting higher priorities first", async () => {
		let active = 0;
		let maximumActive = 0;
		const started: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(async (url: string) => {
				started.push(url);
				active += 1;
				maximumActive = Math.max(maximumActive, active);
				await new Promise((resolve) => setTimeout(resolve, 2));
				active -= 1;
				return { ok: true, json: async () => ({}) };
			}),
		);

		await loadJsonDatasetSlice(
			[
				{
					key: "background",
					url: "/background.json",
					enabled: true,
					priority: 2,
				},
				{
					key: "active",
					url: "/active.json",
					enabled: true,
					priority: 0,
				},
				{
					key: "visible",
					url: "/visible.json",
					enabled: true,
					priority: 1,
				},
				{
					key: "other-1",
					url: "/other-1.json",
					enabled: true,
					priority: 2,
				},
				{
					key: "other-2",
					url: "/other-2.json",
					enabled: true,
					priority: 2,
				},
				{
					key: "other-3",
					url: "/other-3.json",
					enabled: true,
					priority: 2,
				},
			],
			new AbortController().signal,
			parseDataset,
		);
		expect(started.slice(0, 3)).toEqual([
			"/active.json",
			"/visible.json",
			"/background.json",
		]);
		expect(maximumActive).toBeLessThanOrEqual(4);
	});
	describe("dataset cache", () => {
		const load = (keys: string[]) =>
			loadJsonDatasetSlice(
				keys.map((key) => ({
					key,
					url: `/cache-test/${key}.json`,
					enabled: true,
				})),
				new AbortController().signal,
				parseDataset,
			);

		const stubFetch = (failing: string[] = []) => {
			const fetched: string[] = [];
			vi.stubGlobal(
				"fetch",
				vi.fn().mockImplementation(async (url: string) => {
					fetched.push(url);
					if (failing.some((key) => url.endsWith(`/${key}.json`)))
						return { ok: false, status: 503, statusText: "Down" };
					return {
						ok: true,
						json: async () => ({ E1: { value: 1 } }),
					};
				}),
			);
			return fetched;
		};

		it("loads only the dataset a toggle adds", async () => {
			const fetched = stubFetch();
			await load(["toggle-a", "toggle-b"]);
			const slice = await load(["toggle-a", "toggle-b", "toggle-c"]);
			expect(fetched).toEqual([
				"/cache-test/toggle-a.json",
				"/cache-test/toggle-b.json",
				"/cache-test/toggle-c.json",
			]);
			expect(Object.keys(slice.datasets)).toEqual([
				"toggle-a",
				"toggle-b",
				"toggle-c",
			]);
		});

		it("drops a dataset once three newer slices do not use it", async () => {
			const fetched = stubFetch();
			await load(["evict-x"]);
			await load(["evict-y"]);
			await load(["evict-z"]);
			await load(["evict-x"]);
			expect(fetched).toHaveLength(3);
			await load(["evict-w"]);
			await load(["evict-y"]);
			await load(["evict-z"]);
			await load(["evict-w"]);
			await load(["evict-x"]);
			expect(
				fetched.filter((url) => url.endsWith("evict-x.json")),
			).toHaveLength(2);
		});

		it("retries a dataset that failed", async () => {
			const fetched = stubFetch(["retry-broken"]);
			await load(["retry-broken"]);
			await load(["retry-broken"]);
			expect(fetched).toEqual([
				"/cache-test/retry-broken.json",
				"/cache-test/retry-broken.json",
			]);
		});
	});
});
