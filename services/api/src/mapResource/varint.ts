/**
 * Appends an unsigned LEB128 varint: the integer encoding of both protocol
 * buffers, in a vector tile, and the directories of a PMTiles archive.
 */
export const varint = (value: number, into: number[]) => {
	let rest = value;
	while (rest > 0x7f) {
		into.push((rest & 0x7f) | 0x80);
		rest = Math.floor(rest / 128);
	}
	into.push(rest);
};
