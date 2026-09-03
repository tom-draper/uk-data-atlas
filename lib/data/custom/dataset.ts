import type { AreaEntry } from "@/lib/data/areaBank";
import type { BoundaryType } from "@/lib/types";
import type { CustomDataset, CustomPoint } from "@/lib/types/custom";

export interface CustomDatasetUpload {
	file: string;
	headerRow: number;
	data: string[][];
	mode: "choropleth" | "points";
	dataColumn: string;
	selectedColumn?: string;
	boundaryType?: string;
	boundaryYear?: number | null;
	selectedEntry?: AreaEntry;
	latColumn?: string;
	lngColumn?: string;
}

export function createCustomDataset(
	id: string,
	upload: CustomDatasetUpload,
): CustomDataset | null {
	const headers = upload.data[upload.headerRow] ?? [];

	if (upload.mode === "points") {
		const latIndex = headers.indexOf(upload.latColumn ?? "");
		const lngIndex = headers.indexOf(upload.lngColumn ?? "");
		const valueIndex = headers.indexOf(upload.dataColumn);
		if (latIndex === -1 || lngIndex === -1 || valueIndex === -1)
			return null;

		const points: CustomPoint[] = [];
		let valueMin = Infinity;
		let valueMax = -Infinity;
		for (const row of upload.data.slice(upload.headerRow + 1)) {
			const lat = Number.parseFloat(row[latIndex]);
			const lng = Number.parseFloat(row[lngIndex]);
			const value = Number.parseFloat(row[valueIndex]);
			if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(value))
				continue;
			points.push({ lat, lng, value });
			valueMin = Math.min(valueMin, value);
			valueMax = Math.max(valueMax, value);
		}

		return {
			id,
			type: "custom",
			kind: "points",
			name: upload.file,
			year: 0,
			boundaryType: "ward",
			boundaryYear: 0,
			dataColumn: upload.dataColumn,
			data: {},
			points,
			valueMin: points.length ? valueMin : 0,
			valueMax: points.length ? valueMax : 0,
		};
	}

	if (
		upload.boundaryYear == null ||
		!upload.boundaryType ||
		!upload.selectedColumn
	)
		return null;

	const codeIndex = headers.indexOf(upload.selectedColumn);
	const valueIndex = headers.indexOf(upload.dataColumn);
	if (codeIndex === -1 || valueIndex === -1) return null;

	const data: Record<string, number> = {};
	const nameToCode =
		upload.selectedEntry?.matchType === "name"
			? upload.selectedEntry.nameToCode
			: null;
	for (const row of upload.data.slice(upload.headerRow + 1)) {
		let code = row[codeIndex]?.trim();
		const value = Number.parseFloat(row[valueIndex]);
		if (nameToCode && code)
			code = nameToCode.get(code.toLowerCase()) ?? code;
		if (code && !Number.isNaN(value)) data[code] = value;
	}

	return {
		id,
		type: "custom",
		kind: "choropleth",
		name: upload.file,
		year: upload.boundaryYear,
		boundaryType: upload.boundaryType as BoundaryType,
		boundaryYear: upload.boundaryYear,
		dataColumn: upload.dataColumn,
		data,
	};
}
