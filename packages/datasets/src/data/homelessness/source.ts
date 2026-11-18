import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import type { OdsTableOptions } from "../spreadsheet/ods.ts";
import { sourceDir } from "../../declaration/sources.ts";

const LAD_CODE = /^E(?:06|07|08|09)\d{6}$/;

const TABLE_OPTIONS: OdsTableOptions = {
	table: "TA1",
	label: "homelessness",
	maxColumns: 7,
};

/**
 * Households in temporary accommodation of each English local authority at
 * the end of January to March 2026, with the rate per thousand households
 * and the children in them. A row missing any figure is left out.
 */
export async function homelessnessStatisticsParts(
	readRows: (
		path: string,
		options: OdsTableOptions,
		visit: (row: readonly string[]) => void,
	) => Promise<void>,
): Promise<DirectPart[]> {
	const records = new Map<string, DirectRecord>();
	await readRows(
		sourceDir("homelessness", "homelessness-2026-q1.ods"),
		TABLE_OPTIONS,
		(row) => {
			const [
				code,
				name,
				total,
				_households,
				perThousand,
				withChildren,
				children,
			] = row;
			if (!code || !name || !LAD_CODE.test(code)) return;
			const raw = [total, perThousand, withChildren, children];
			if (raw.some((value) => !value)) return;
			const [all, rate, families, kids] = raw.map(Number);
			if (![all, rate, families, kids].every(Number.isFinite)) return;
			records.set(code, {
				code,
				name,
				values: [
					{
						measure: "households-in-temporary-accommodation",
						members: { "household-type": "all" },
						value: all,
					},
					{
						measure: "households-in-temporary-accommodation",
						members: { "household-type": "with-children" },
						value: families,
					},
					{
						measure: "households-in-temporary-accommodation-rate",
						value: rate,
					},
					{
						measure: "children-in-temporary-accommodation",
						value: kids,
					},
				],
			});
		},
	);
	return [{ key: "2026", records: [...records.values()] }];
}
