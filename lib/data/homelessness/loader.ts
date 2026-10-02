import {
	HomelessnessDataset,
	HomelessnessLADData,
} from "@/lib/types/homelessness";
import type { OdsTableOptions } from "@/lib/data/spreadsheet/ods";

const TABLE_NAME = "TA1";
const MAX_COLUMNS = 7;
const LAD_CODE = /^E(?:06|07|08|09)\d{6}$/;

const TABLE_OPTIONS: OdsTableOptions = {
	table: TABLE_NAME,
	label: "homelessness",
	maxColumns: MAX_COLUMNS,
};

export async function loadHomelessness(
	readRows: (
		path: string,
		options: OdsTableOptions,
		visit: (row: readonly string[]) => void,
	) => Promise<void>,
): Promise<Record<string, HomelessnessDataset>> {
	const data: Record<string, HomelessnessLADData> = {};
	await readRows(
		"economics/homelessness/homelessness-2026-q1.ods",
		TABLE_OPTIONS,
		(row) => {
			const [
				ladCode,
				ladName,
				total,
				_households,
				perThousand,
				withChildren,
				children,
			] = row;
			if (!ladCode || !ladName || !LAD_CODE.test(ladCode)) return;
			const rawValues = [total, perThousand, withChildren, children];
			if (rawValues.some((value) => !value)) return;
			const values = rawValues.map(Number);
			if (values.some((value) => !Number.isFinite(value))) return;
			data[ladCode] = {
				ladCode,
				ladName,
				householdsInTemporaryAccommodation: values[0],
				householdsPerThousand: values[1],
				householdsWithChildren: values[2],
				childrenInTemporaryAccommodation: values[3],
			};
		},
	);

	return {
		2026: {
			id: "homelessness2026q1",
			type: "homelessness",
			year: 2026,
			quarter: "Jan-Mar 2026",
			boundaryType: "localAuthority",
			boundaryYear: 2025,
			data,
		},
	};
}
