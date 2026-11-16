import type { DirectPart } from "../../declaration/statistics.ts";
import type { DatasetReader } from "../catalog/types.ts";
import { odsTableRows } from "../spreadsheet/ods.ts";
import { sourceDir } from "../../declaration/sources.ts";
import { mapAuthorityCode } from "./authorityCode.ts";

/** Read an indicator workbook into statistics records, retaining source order. */
export async function directIndicator(
	reader: DatasetReader,
	options: {
		id: Parameters<typeof sourceDir>[0];
		file: string;
		table: string;
		columns: number;
		key: string;
		measure: string;
		read: (
			rows: string[][],
		) => Iterable<{ code: string; name: string; value: number | null }>;
	},
): Promise<DirectPart[]> {
	const rows = odsTableRows(
		await reader.odsContent(sourceDir(options.id, options.file)),
		{
			table: options.table,
			label: options.table,
			maxColumns: options.columns,
		},
	);
	const records = new Map<string, DirectPart["records"][number]>();
	for (const { code, name, value } of options.read(rows)) {
		if (!mapAuthorityCode(code) || value === null) continue;
		records.set(code, {
			code,
			name: name || code,
			values: [{ measure: options.measure, value }],
		});
	}
	return [{ key: options.key, records: [...records.values()] }];
}
