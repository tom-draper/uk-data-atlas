/**
 * A reader for the protobuf wire format and for vector tiles, written from the
 * Mapbox Vector Tile 2.1 specification rather than from the writer it checks.
 * Kept beside the tests so the writer is never verified by its own rules.
 */

type Field = { field: number; wire: number; value: number | Buffer };

/** Protobuf wire format: a tag, then a varint or a length-delimited block. */
export const readFields = (buffer: Buffer): Field[] => {
	const fields: Field[] = [];
	let at = 0;
	const varint = () => {
		let value = 0;
		let shift = 1;
		for (;;) {
			const byte = buffer[at]!;
			at += 1;
			value += (byte & 0x7f) * shift;
			if ((byte & 0x80) === 0) return value;
			shift *= 128;
		}
	};
	while (at < buffer.length) {
		const tag = varint();
		const field = Math.floor(tag / 8);
		const wire = tag & 7;
		if (wire === 0) fields.push({ field, wire, value: varint() });
		else if (wire === 2) {
			const length = varint();
			fields.push({
				field,
				wire,
				value: buffer.subarray(at, at + length),
			});
			at += length;
		} else if (wire === 1) {
			fields.push({ field, wire, value: buffer.readDoubleLE(at) });
			at += 8;
		} else throw new Error(`Unsupported wire type ${wire}`);
	}
	return fields;
};

export const packedVarints = (buffer: Buffer): number[] => {
	const values: number[] = [];
	let at = 0;
	while (at < buffer.length) {
		let value = 0;
		let shift = 1;
		for (;;) {
			const byte = buffer[at]!;
			at += 1;
			value += (byte & 0x7f) * shift;
			if ((byte & 0x80) === 0) break;
			shift *= 128;
		}
		values.push(value);
	}
	return values;
};

const unzigzag = (value: number) =>
	value % 2 === 0 ? value / 2 : -(value + 1) / 2;

export type DecodedFeature = {
	id: number;
	rings: Array<Array<[number, number]>>;
	properties: Record<string, string | number>;
};

export const decodeTile = (buffer: Buffer) => {
	const layers = readFields(buffer)
		.filter((entry) => entry.field === 3)
		.map((entry) => {
			const fields = readFields(entry.value as Buffer);
			const text = (block: Buffer) => block.toString("utf8");
			const name = text(
				fields.find((one) => one.field === 1)!.value as Buffer,
			);
			const keys = fields
				.filter((one) => one.field === 3)
				.map((one) => text(one.value as Buffer));
			const values = fields
				.filter((one) => one.field === 4)
				.map((one) => {
					const inner = readFields(one.value as Buffer)[0]!;
					if (inner.field === 1) return text(inner.value as Buffer);
					if (inner.field === 6)
						return unzigzag(inner.value as number);
					return inner.value as number;
				});
			const extent = fields.find((one) => one.field === 5)?.value ?? 4096;
			const version = fields.find((one) => one.field === 15)?.value;
			const features = fields
				.filter((one) => one.field === 2)
				.map((one): DecodedFeature => {
					const parts = readFields(one.value as Buffer);
					const id = parts.find((p) => p.field === 1)!
						.value as number;
					const tags = parts.find((p) => p.field === 2);
					const geometry = packedVarints(
						parts.find((p) => p.field === 4)!.value as Buffer,
					);
					const properties: Record<string, string | number> = {};
					const pairs = tags
						? packedVarints(tags.value as Buffer)
						: [];
					for (let i = 0; i < pairs.length; i += 2)
						properties[keys[pairs[i]!]!] = values[pairs[i + 1]!]!;

					// Commands: the low three bits are the command, the rest
					// the number of times it repeats.
					const rings: Array<Array<[number, number]>> = [];
					let current: Array<[number, number]> = [];
					let x = 0;
					let y = 0;
					let at = 0;
					while (at < geometry.length) {
						const header = geometry[at]!;
						at += 1;
						const command = header & 7;
						const count = header >> 3;
						if (command === 7) {
							if (current.length > 0) rings.push(current);
							current = [];
							continue;
						}
						for (let step = 0; step < count; step += 1) {
							x += unzigzag(geometry[at]!);
							y += unzigzag(geometry[at + 1]!);
							at += 2;
							current.push([x, y]);
						}
					}
					if (current.length > 0) rings.push(current);
					return { id, rings, properties };
				});
			return { name, extent, version, features };
		});
	return layers;
};
