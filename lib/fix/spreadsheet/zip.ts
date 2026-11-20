import { strFromU8, unzipSync } from "fflate";

/** Most uncompressed bytes read from one file, and from all of them. */
const MAX_PART_BYTES = 200 * 1024 * 1024;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;

/**
 * Reads the named parts of a zip as text. The sizes a zip declares are
 * checked before anything is inflated, so a small file cannot expand into
 * gigabytes.
 */
export function readParts(
	bytes: Uint8Array,
	wanted: (name: string) => boolean,
): Map<string, string> {
	let total = 0;
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(bytes, {
			filter: (file) => {
				if (!wanted(file.name)) return false;
				total += file.originalSize;
				if (
					file.originalSize > MAX_PART_BYTES ||
					total > MAX_TOTAL_BYTES
				)
					throw new RangeError("too large");
				return true;
			},
		});
	} catch (error) {
		if (error instanceof RangeError)
			throw new Error(
				"That spreadsheet is too large to read in the browser. Save the sheet you need as CSV instead.",
			);
		throw new Error(
			"That file could not be opened as a spreadsheet. Check it isn't damaged or password protected.",
		);
	}
	return new Map(
		Object.entries(files).map(([name, data]) => [name, strFromU8(data)]),
	);
}

/** A part's path from a relationship target, which may be absolute or relative. */
export function resolvePart(base: string, target: string): string {
	if (target.startsWith("/")) return target.slice(1);
	const parts = base.split("/").slice(0, -1);
	for (const segment of target.split("/")) {
		if (segment === "..") parts.pop();
		else if (segment !== "." && segment !== "") parts.push(segment);
	}
	return parts.join("/");
}
