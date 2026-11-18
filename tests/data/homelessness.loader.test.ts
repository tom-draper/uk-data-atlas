import { describe, expect, it } from "vitest";
import {
	sourceDir,
	homelessnessStatisticsParts,
} from "@uk-data-atlas/datasets";
import { odsTableRows } from "@uk-data-atlas/datasets";

const worksheet = `
<table:table table:name="TA1">
	<table:table-row>
		<table:table-cell office:value-type="string"><text:p>E06000001</text:p></table:table-cell>
		<table:table-cell office:value-type="string"><text:p>Hartlepool</text:p></table:table-cell>
		<table:table-cell office:value="310"><text:p>310</text:p></table:table-cell>
		<table:table-cell office:value="42"><text:p>42</text:p></table:table-cell>
		<table:table-cell office:value="7.4"><text:p>7.4</text:p></table:table-cell>
		<table:table-cell office:value="180"><text:p>180</text:p></table:table-cell>
		<table:table-cell office:value="430"><text:p>430</text:p></table:table-cell>
	</table:table-row>
	<table:table-row>
		<table:table-cell office:value-type="string"><text:p>E92000001</text:p></table:table-cell>
		<table:table-cell office:value-type="string"><text:p>ENGLAND</text:p></table:table-cell>
	</table:table-row>
</table:table>`;

const hartlepool = {
	code: "E06000001",
	name: "Hartlepool",
	values: [
		{
			measure: "households-in-temporary-accommodation",
			members: { "household-type": "all" },
			value: 310,
		},
		{
			measure: "households-in-temporary-accommodation",
			members: { "household-type": "with-children" },
			value: 180,
		},
		{
			measure: "households-in-temporary-accommodation-rate",
			value: 7.4,
		},
		{ measure: "children-in-temporary-accommodation", value: 430 },
	],
};

describe("homelessnessStatisticsParts", () => {
	it("reads rows as they are read from the ODS table", async () => {
		const parts = await homelessnessStatisticsParts(
			async (path, options, visit) => {
				expect(path).toBe(
					sourceDir("homelessness", "homelessness-2026-q1.ods"),
				);
				expect(options).toEqual({
					table: "TA1",
					label: "homelessness",
					maxColumns: 7,
				});
				visit([
					"E06000001",
					"Hartlepool",
					"310",
					"42",
					"7.4",
					"180",
					"430",
				]);
			},
		);

		expect(parts.map(({ key }) => key)).toEqual(["2026"]);
		expect(parts[0].records).toEqual([hartlepool]);
	});

	it("extracts TA1 local-authority temporary accommodation data", async () => {
		const [part] = await homelessnessStatisticsParts(
			async (_path, options, visit) => {
				for (const row of odsTableRows(worksheet, options)) visit(row);
			},
		);
		expect(part.records).toEqual([hartlepool]);
	});
});
