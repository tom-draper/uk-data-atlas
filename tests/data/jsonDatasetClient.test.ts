import { afterEach, describe, expect, it, vi } from "vitest";
import {
	loadJsonDataset,
	loadJsonDatasetSlice,
} from "@/lib/data/jsonDatasetClient";

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
			),
		).resolves.toEqual({
			datasets: { good: { E1: { value: 4 } } },
			errors: ["Failed to fetch /broken.json: 503 Unavailable"],
		});
	});
});
