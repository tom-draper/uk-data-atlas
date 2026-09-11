import { readFileSync } from "node:fs";

type DbfField = { name: string; length: number };

const readFields = (buffer: Buffer, headerLength: number): DbfField[] => {
	if (headerLength < 33 || headerLength > buffer.length) {
		throw new Error("Invalid dBase header length");
	}
	if (buffer[headerLength - 1] !== 0x0d) {
		throw new Error("The dBase field descriptors are not terminated");
	}
	const fields: DbfField[] = [];
	for (let offset = 32; offset < headerLength - 1; offset += 32) {
		const name = buffer
			.subarray(offset, offset + 11)
			.toString("latin1")
			.replace(/\0.*$/, "")
			.trim();
		const length = buffer[offset + 16];
		if (!name || length === 0) {
			throw new Error("Invalid dBase field descriptor");
		}
		fields.push({ name, length });
	}
	return fields;
};

export const readDbfRecords = (path: string): Array<Record<string, string>> => {
	const buffer = readFileSync(path);
	if (buffer.length < 33) throw new Error(`${path}: file is too short`);
	const recordCount = buffer.readUInt32LE(4);
	const headerLength = buffer.readUInt16LE(8);
	const recordLength = buffer.readUInt16LE(10);
	const fields = readFields(buffer, headerLength);
	const fieldLength = fields.reduce(
		(total, field) => total + field.length,
		0,
	);
	if (recordLength !== fieldLength + 1) {
		throw new Error(
			`${path}: record length does not match field definitions`,
		);
	}
	if (headerLength + recordCount * recordLength > buffer.length) {
		throw new Error(`${path}: file ends before its declared records`);
	}
	return Array.from({ length: recordCount }, (_, index) => {
		const offset = headerLength + index * recordLength;
		if (buffer[offset] === 0x2a) return undefined;
		let fieldOffset = offset + 1;
		const record = Object.fromEntries(
			fields.map((field) => {
				const value = buffer
					.subarray(fieldOffset, fieldOffset + field.length)
					.toString("latin1")
					.trim();
				fieldOffset += field.length;
				return [field.name, value];
			}),
		);
		return record;
	}).filter(
		(record): record is Record<string, string> => record !== undefined,
	);
};
