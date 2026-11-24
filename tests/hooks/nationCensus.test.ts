import { describe, expect, it } from "vitest";
import { MeasureQueryError } from "@/lib/measures/client";
import { loadNationCensus } from "@/lib/measures/nationCensus";
import type {
	MeasureValuesPayload,
	MeasureValuesRequest,
} from "@/lib/measures/types";

const payload = (
	values: Record<string, number | null>,
	extensive = true,
): MeasureValuesPayload => ({
	measure: {
		id: "households",
		label: "Households",
		description: "",
		valueKind: "count",
		unit: "households",
		aggregation: {
			kind: extensive ? "extensive" : "intensive",
			available: extensive,
		},
		dimensions: [],
	} as never,
	series: { id: "s", dimensions: {} },
	source: {
		datasetId: "census-2022-scotland-uv404",
		geography: "dataZone",
		boundaryYear: 2022,
		periods: ["2022"],
	},
	statuses: ["observed", "missing"],
	periods: ["2022"],
	areas: Object.keys(values),
	columns: [
		{
			period: "2022",
			values: Object.values(values),
			status: Object.values(values).map((value) =>
				value === null ? 1 : 0,
			),
		},
	],
	extent: null,
	contentHash: "x",
});

const nations = {
	covers: ["E", "W"],
	measure: "households",
	dimension: "tenure",
	members: [
		{ key: "total", code: "total" },
		{ key: "owned", code: "owned" },
		{ key: "outright", code: "owned-outright" },
	],
	fromMetrics: () => null,
};

const answers: Record<string, () => MeasureValuesPayload> = {
	total: () => payload({ Z1: 100, Z2: 50, Z3: 7 }),
	"owned-outright": () => payload({ Z1: 30, Z2: 20, Z3: 1 }),
};
const load = async (request: Omit<MeasureValuesRequest, "areas">) => {
	const code = request.dimensions!.tenure![0]!;
	const answer = answers[code];
	if (!answer)
		throw new MeasureQueryError(404, "series_not_found", "not published");
	return answer();
};

describe("nation census loader", () => {
	it("sums each published member over the council's zones and names its source", async () => {
		const census = await loadNationCensus(
			nations,
			2022,
			["Z1", "Z2"],
			load,
		);
		expect(census).toEqual({
			metrics: { total: 150, outright: 50 },
			period: "2022",
			datasetId: "census-2022-scotland-uv404",
			refused: ["owned"],
		});
	});

	it("leaves out a member some zone has no value for", async () => {
		const census = await loadNationCensus(
			nations,
			2022,
			["Z1", "Z9"],
			load,
		);
		expect(census.metrics).toEqual({});
	});

	it("never sums a measure that does not add up", async () => {
		const census = await loadNationCensus(nations, 2022, ["Z1"], async () =>
			payload({ Z1: 3 }, false),
		);
		expect(census.metrics).toEqual({});
	});

	it("lets a failure of the route through", async () => {
		await expect(
			loadNationCensus(nations, 2022, ["Z1"], async () => {
				throw new MeasureQueryError(503, "unavailable", "down");
			}),
		).rejects.toThrow("down");
	});
});
