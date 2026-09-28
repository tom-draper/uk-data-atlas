import {
	HomelessnessDataset,
	HomelessnessLADData,
} from "@/lib/types/homelessness";
import { odsTableRows } from "@/lib/data/spreadsheet/ods";

const TABLE_NAME = "TA1";
const MAX_COLUMNS = 7;
const LAD_CODE = /^E(?:06|07|08|09)\d{6}$/;

const tableRows = (contentXml: string) =>
	odsTableRows(contentXml, {
		table: TABLE_NAME,
		label: "homelessness",
		maxColumns: MAX_COLUMNS,
	});

export function loadHomelessness(
	contentXml: string,
): Record<string, HomelessnessDataset> {
	const data: Record<string, HomelessnessLADData> = {};
	for (const row of tableRows(contentXml)) {
		const [
			ladCode,
			ladName,
			total,
			_households,
			perThousand,
			withChildren,
			children,
		] = row;
		if (!ladCode || !ladName || !LAD_CODE.test(ladCode)) continue;
		const rawValues = [total, perThousand, withChildren, children];
		if (rawValues.some((value) => !value)) continue;
		const values = rawValues.map(Number);
		if (values.some((value) => !Number.isFinite(value))) continue;
		data[ladCode] = {
			ladCode,
			ladName,
			householdsInTemporaryAccommodation: values[0],
			householdsPerThousand: values[1],
			householdsWithChildren: values[2],
			childrenInTemporaryAccommodation: values[3],
		};
	}

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
