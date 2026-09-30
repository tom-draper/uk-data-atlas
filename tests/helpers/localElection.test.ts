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

	it("finds a picked ward's result for the same area, not for its code", () => {
		// W-OLD was renumbered W-NEW with its extent unchanged; S kept its code
		// though its boundary moved.
		const codeMapper = {
			hasAreaLineage: () => true,
			getCodeForYear: (_: string, code: string) =>
				({ "W-OLD": "W-NEW", K: "K" })[code],
		};
		const results = dataset({ "W-NEW": { votes: 7 }, S: { votes: 9 } });
		const pick = (code: string, boundaryYear?: number) =>
			computeLocalElectionYearData(
				2024,
				results,
				null,
				{ type: "ward", code, name: code, data: null, boundaryYear },
				codeMapper,
				undefined,
				undefined,
				0,
				undefined,
				undefined,
			);

		expect(pick("W-OLD", 2021).totalVotes).toBe(7);
		expect(pick("S", 2021)).toMatchObject({
			hasData: false,
			boundariesChanged: true,
		});
		// A ward in the same area with no election that year.
		expect(pick("K", 2021)).toMatchObject({ hasData: false });
		expect(pick("K", 2021).boundariesChanged).toBeUndefined();
		// Without its boundary year, a ward is found by its code.
		expect(pick("S").totalVotes).toBe(9);
	});
});
