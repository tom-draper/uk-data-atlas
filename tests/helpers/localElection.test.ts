import { describe, expect, it, vi } from "vitest";
import { computeLocalElectionYearData } from "@/lib/helpers/localElection";

const dataset = (data: Record<string, { votes: number }>) =>
	({
		id: "local-election-2024",
		type: "localElection",
		year: 2024,
		boundaryType: "ward",
		boundaryYear: 2024,
		results: {},
		partyInfo: [{ key: "LAB", name: "Labour" }],
		data: Object.fromEntries(
			Object.entries(data).map(([code, value]) => [
				code,
				{
					wardCode: code,
					ladCode: "L1",
					ladName: "LAD",
					wardName: code,
					totalVotes: value.votes,
					turnoutPercent: 0,
					electorate: 100,
					partyVotes: { LAB: value.votes },
				},
			]),
		),
	}) as any;

describe("computeLocalElectionYearData", () => {
	it("caches constituency aggregation until the mapping generation changes", () => {
		const wards = vi.fn(() => ["W1"]);
		const selectedArea = {
			type: "constituency",
			code: "C-cache-test",
		} as any;
		const firstDataset = dataset({ W1: { votes: 10 }, W2: { votes: 20 } });
		const compute = (source: typeof firstDataset, generation: number) =>
			computeLocalElectionYearData(
				2024,
				source,
				null,
				selectedArea,
				undefined,
				undefined,
				wards,
				generation,
				undefined,
				undefined,
			);

		expect(compute(firstDataset, 0).totalVotes).toBe(10);
		expect(compute(firstDataset, 0).totalVotes).toBe(10);
		expect(wards).toHaveBeenCalledTimes(1);

		wards.mockReturnValue(["W2"]);
		expect(compute(firstDataset, 1).totalVotes).toBe(20);
		expect(wards).toHaveBeenCalledTimes(2);

		const replacementDataset = dataset({ W2: { votes: 30 } });
		expect(compute(replacementDataset, 1).totalVotes).toBe(30);
		expect(wards).toHaveBeenCalledTimes(3);
	});
});
