/**
 * Guesses about an uploaded table's columns from their headers alone. Kept
 * free of the atlas's area data so any page reading a CSV can use them.
 */

const PARENT_HEADER =
	/^(lad\d*(cd|nm|code|name)?|la( ?(code|name))?|local ?authority.*|council.*|district.*|borough.*)$/i;

/** The column most likely to name each row's local authority, from headers. */
export function guessParentColumn(
	headerCells: string[],
	areaColumn: string,
): string | undefined {
	return headerCells.find(
		(header) => header !== areaColumn && PARENT_HEADER.test(header.trim()),
	);
}
