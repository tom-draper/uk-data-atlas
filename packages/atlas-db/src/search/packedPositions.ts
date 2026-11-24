/** Ascending positions, packed as little-endian u32s. */
export const packPositions = (positions: readonly number[]) => {
	const bytes = new Uint8Array(positions.length * 4);
	const view = new DataView(bytes.buffer);
	positions.forEach((position, index) =>
		view.setUint32(index * 4, position, true),
	);
	return bytes;
};
