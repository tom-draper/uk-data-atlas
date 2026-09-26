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
				"json-client-test-slice",
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
			"json-client-priority-test-slice",
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
});
