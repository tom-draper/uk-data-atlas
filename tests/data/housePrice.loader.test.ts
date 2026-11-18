import { describe, expect, it } from "vitest";
import { housePriceStatisticsParts } from "@uk-data-atlas/datasets";

const rows = [
	["Median price paid by ward"],
	[
		"Local authority code",
		"Local authority name",
		"Ward code",
		"Ward name",
		"Year ending Dec 2021",
		"Year ending Dec 2022",
	],
	["E08000006", "Salford", "E05000759", "Barton", "170000", "179500"],
	["E06000001", "Hartlepool", "E05008945", "Foggy Furze", "90000", "95000"],
];

const read = async (
	_path: string,
	_sheet: string,
	visit: (row: ReadonlyMap<number, string>) => void,
) => {
	for (const row of rows)
		visit(new Map(row.map((value, column) => [column, value])));
};

describe("housePriceStatisticsParts", () => {
	it("starts median and mean workbooks before either finishes", async () => {
		const started: string[] = [];
		let release: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const slowRead = async (
			path: string,
			_sheet: string,
			visit: (row: ReadonlyMap<number, string>) => void,
		) => {
			started.push(path);
			await gate;
			for (const values of rows)
				visit(new Map(values.map((value, index) => [index, value])));
		};

		const loading = housePriceStatisticsParts(slowRead);
		try {
			expect(started).toHaveLength(2);
		} finally {
			release!();
		}
		await loading;
	});

	it("keeps the publisher's code on a ward it moves for the map", async () => {
		const [part] = await housePriceStatisticsParts(read);
		const ward = part.records.find(({ code }) => code === "E05013018")!;

		// Salford's redrawn ward joins the map under its 2021 code, but the old
		// code the price was published against stays on the record.
		expect(ward.parents).toMatchObject({
			ladCode: { code: "E08000006", name: "Salford" },
			sourceWardCode: { code: "E05000759" },
		});
		expect(ward.values).toContainEqual(
			expect.objectContaining({
				measure: "house-price-median",
				value: 179500,
				period: expect.objectContaining({ label: "2022" }),
			}),
		);
	});

	it("adds no source code where the ward was not moved", async () => {
		const [part] = await housePriceStatisticsParts(read);
		const ward = part.records.find(({ code }) => code === "E05008945")!;
		expect(ward.parents).not.toHaveProperty("sourceWardCode");
	});
});
