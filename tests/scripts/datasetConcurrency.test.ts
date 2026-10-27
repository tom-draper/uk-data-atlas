import { availableParallelism } from "node:os";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { datasetConcurrency } from "@/pipeline/src/precompile/datasetConcurrency.mjs";

vi.mock("node:os", () => ({
	availableParallelism: vi.fn(() => 8),
	totalmem: () => 16 * 1024 ** 3,
}));

const GIB = 1024 ** 3;

beforeEach(() => {
	vi.stubEnv("ATLAS_PRECOMPILE_JOBS", "");
	vi.mocked(availableParallelism).mockReturnValue(8);
	vi.spyOn(process, "availableMemory").mockReturnValue(3 * GIB);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

it("uses available memory and reserves room for the parent", () => {
	expect(datasetConcurrency()).toBe(1);
	vi.mocked(process.availableMemory).mockReturnValue(5 * GIB);
	expect(datasetConcurrency()).toBe(2);
});

it("caps workers and leaves a CPU for the parent", () => {
	vi.mocked(process.availableMemory).mockReturnValue(20 * GIB);
	expect(datasetConcurrency()).toBe(4);
	vi.mocked(availableParallelism).mockReturnValue(3);
	expect(datasetConcurrency()).toBe(2);
});

it("runs on the main thread with little memory or a single CPU", () => {
	vi.mocked(process.availableMemory).mockReturnValue(0);
	expect(datasetConcurrency()).toBe(1);
	vi.mocked(process.availableMemory).mockReturnValue(20 * GIB);
	vi.mocked(availableParallelism).mockReturnValue(1);
	expect(datasetConcurrency()).toBe(1);
});

it("preserves an explicit worker override", () => {
	vi.stubEnv("ATLAS_PRECOMPILE_JOBS", "6");
	expect(datasetConcurrency()).toBe(6);
});

it.each(["0", "-1", "1.5", "invalid"])(
	"falls back to the resource budget for override %s",
	(value) => {
		vi.stubEnv("ATLAS_PRECOMPILE_JOBS", value);
		expect(datasetConcurrency()).toBe(1);
	},
);
