export const parseNum = (val: string): number => {
	if (!val || val.trim() === "") return 0;
	const parsed = Number(val.replace(/,/g, "").trim());
	return isNaN(parsed) ? 0 : parsed;
};

export const parseNumInt = (val: string): number => {
	if (!val || val.trim() === "") return 0;
	const parsed = parseInt(val.replace(/,/g, "").trim(), 10);
	return isNaN(parsed) ? 0 : parsed;
};

export const parsePct = (val: string): number => {
	if (!val || val.trim() === "") return 0;
	const parsed = Number(val.replace(/%/g, "").trim());
	return isNaN(parsed) ? 0 : parsed;
};

export const parseNullableInt = (val: unknown): number | null => {
	if (val === null || val === undefined || val === "") return null;
	const parsed = parseInt(String(val).replace(/,/g, "").trim(), 10);
	return isNaN(parsed) ? null : parsed;
};

export const parseNullableNum = (val: unknown): number | null => {
	if (val === null || val === undefined || val === "") return null;
	const s = String(val).trim();
	// Statistical suppression markers used in ONS/govt datasets
	if (s === "x" || s === ".." || s === ":" || s === "-") return null;
	const parsed = Number(s.replace(/,/g, ""));
	return isNaN(parsed) ? null : parsed;
};

/** Reads a number from a spreadsheet cell, treating anything unreadable as 0. */
export const parseNumOrZero = (value: unknown): number => {
	const parsed = parseFloat(
		String(value ?? "")
			.replace(/,/g, "")
			.trim(),
	);
	return isNaN(parsed) ? 0 : parsed;
};
