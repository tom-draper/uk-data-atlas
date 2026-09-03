/**
 * Reading an uploaded CSV: which columns it offers, which area set its codes
 * match, and whether the result can be put on the map. All pure, so the upload
 * modal only has to hold the state and draw it.
 */
import {
	matchColumnAgainstBank,
	type AreaBank,
	type AreaMatch,
	type CoordinateColumns,
} from "@/lib/data/areaBank";
import type { CustomDatasetUpload } from "./dataset";

/** A column offered to the pickers, with a taste of its first data row. */
export interface UploadColumn {
	name: string;
	preview: string;
	index: number;
}

const PREVIEW_LENGTH = 25;

// A boundary set matched this well leaves lat/lng columns looking incidental.
const BOUNDARY_MATCH_THRESHOLD = 60;

const CODE_COLUMN_RE = /code|area|ward|constituency|authority/i;

/** Match types that name a place the atlas cannot yet draw a boundary for. */
export function isSpecialMatchType(matchType: string): boolean {
	return (
		matchType === "postcode-full" ||
		matchType === "postcode-district" ||
		matchType === "coordinate"
	);
}

export function uploadColumns(
	csvData: string[][],
	headerRow: number,
): UploadColumn[] {
	const firstDataRow = csvData[headerRow + 1] ?? [];
	return (csvData[headerRow] ?? []).map((name, index) => ({
		name,
		preview: (firstDataRow[index] ?? "").slice(0, PREVIEW_LENGTH),
		index,
	}));
}

/** The column most likely to hold area codes, from its header alone. */
export function guessCodeColumn(headerCells: string[]): string | undefined {
	return headerCells.find((header) => CODE_COLUMN_RE.test(header));
}

/** How well one column's values match each area set the bank knows. */
export function matchColumn(
	csvData: string[][],
	headerRow: number,
	selectedColumn: string,
	areaBank: AreaBank,
): AreaMatch[] {
	if (!csvData.length || !selectedColumn) return [];
	const columnIndex = (csvData[headerRow] ?? []).indexOf(selectedColumn);
	if (columnIndex === -1) return [];

	const columnData = csvData.slice(headerRow + 1).flatMap((row) => {
		const value = row[columnIndex];
		return value?.trim() ? [value] : [];
	});
	return matchColumnAgainstBank(columnData, areaBank);
}

/** The match in play: the one the reader picked, else the strongest. */
export function chooseMatch(
	matches: AreaMatch[],
	overrideLabel: string,
): AreaMatch | null {
	return (
		(overrideLabel &&
			matches.find((match) => match.entry.label === overrideLabel)) ||
		matches[0] ||
		null
	);
}

/** Whether the chosen match resolves to boundaries the atlas can colour. */
export function canVisualise(match: AreaMatch | null): boolean {
	return match !== null && !isSpecialMatchType(match.entry.matchType);
}

/**
 * A CSV carrying lat/lng goes to the point-plotting flow, unless its codes
 * match a boundary set strongly enough that the coordinates are incidental.
 */
export function isPointMode(
	coord: CoordinateColumns | null,
	matches: AreaMatch[],
): boolean {
	if (!coord) return false;
	const bestBoundaryPct =
		matches.find(
			(match) =>
				match.entry.matchType === "code" ||
				match.entry.matchType === "name",
		)?.percentage ?? 0;
	return bestBoundaryPct < BOUNDARY_MATCH_THRESHOLD;
}

/** The value column to offer in point mode: the first numeric non-coordinate. */
export function guessValueColumn(
	csvData: string[][],
	headerRow: number,
	coord: CoordinateColumns,
): string | undefined {
	const headers = csvData[headerRow] ?? [];
	const firstRow = csvData[headerRow + 1] ?? [];
	const index = headers.findIndex(
		(_, i) =>
			i !== coord.latIdx &&
			i !== coord.lngIdx &&
			firstRow[i]?.trim() &&
			!isNaN(Number(firstRow[i])),
	);
	return index >= 0 ? headers[index] : undefined;
}

export interface UploadDraft {
	file: string | null;
	csvData: string[][];
	headerRow: number;
	selectedColumn: string;
	dataColumn: string;
	latColumn: string;
	lngColumn: string;
}

/**
 * The upload a draft describes, or the reason it cannot be sent yet. Returning
 * the message keeps every validation rule in one readable place.
 */
export function buildUpload(
	draft: UploadDraft,
	pointMode: boolean,
	match: AreaMatch | null,
): { upload: CustomDatasetUpload } | { error: string } {
	const { file, csvData, headerRow, dataColumn } = draft;

	if (pointMode) {
		if (!file || !draft.latColumn || !draft.lngColumn || !dataColumn) {
			return {
				error: "Please select latitude, longitude, and value columns",
			};
		}
		return {
			upload: {
				file,
				headerRow,
				data: csvData,
				mode: "points",
				latColumn: draft.latColumn,
				lngColumn: draft.lngColumn,
				dataColumn,
			},
		};
	}

	if (!file || !draft.selectedColumn || !dataColumn || !match) {
		return {
			error: "Please select a file, area code column, data column, and matching area type",
		};
	}

	if (!canVisualise(match)) {
		return { error: "Postcode visualisation is coming soon." };
	}

	return {
		upload: {
			file,
			headerRow,
			mode: "choropleth",
			selectedColumn: draft.selectedColumn,
			dataColumn,
			boundaryType: match.entry.boundaryType,
			boundaryYear: match.entry.year || null,
			selectedEntry: match.entry,
			data: csvData,
		},
	};
}
