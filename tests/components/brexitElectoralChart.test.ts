import { describe, expect, it } from "vitest";
import { resolveBrexitElectoralStats } from "@/components/elections/referendum/BrexitElectoralChart";
import type {
	AggregatedBrexitData,
	BrexitLADDataset,
	SelectedArea,
} from "@/lib/types";

const dataset: BrexitLADDataset = {
	id: "brexit-2016",
	type: "brexit",
	year: 2016,
	boundaryType: "localAuthority",
	boundaryYear: 2023,
	data: {
		OLD: {
			ladCode: "OLD",
			ladName: "Example local authority",
			regionName: "Example region",
			regionCode: "R1",
			electorate: 1_000,
			validVotes: 800,
			remain: 320,
			leave: 480,
			rejectedBallots: 10,
			pctRemain: 40,
			pctLeave: 60,
			pctTurnout: 80,
		},
	},
	results: { OLD: "leave" },
};

const aggregate: AggregatedBrexitData = {
	totalLeave: 480,
	totalRemain: 320,
	totalVotes: 800,
	pctLeave: 60,
	pctRemain: 40,
	electorate: 1_000,
};

describe("resolveBrexitElectoralStats", () => {
	it("shows the selection aggregate when no area is hovered", () => {
		expect(
			resolveBrexitElectoralStats(dataset, { 2016: aggregate }, null),
		).toEqual({
			pctLeave: 60,
			pctRemain: 40,
			totalLeave: 480,
			totalRemain: 320,
			totalVotes: 800,
		});
	});

	it("resolves a hovered ward through its local authority", () => {
		const ward: SelectedArea = {
			type: "ward",
			code: "E05000001",
			name: "Example ward",
			data: null,
		};

		expect(
			resolveBrexitElectoralStats(dataset, null, ward, {
				getLadForWard: () => "NEW",
				getCodeForYear: (_type, code, year) =>
					code === "NEW" && year === 2023 ? "OLD" : undefined,
			}),
		).toEqual({
			pctLeave: 60,
			pctRemain: 40,
			totalLeave: 480,
			totalRemain: 320,
			totalVotes: 800,
		});
	});
});
