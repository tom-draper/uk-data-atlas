/**
 * Reads a worksheet out of a legacy .xls workbook.
 *
 * An .xls is not a zip. It is a Compound File Binary container — a FAT
 * filesystem in a file — holding a "Workbook" stream, which is itself a flat
 * sequence of BIFF records: a two byte type, a two byte length, then the
 * payload. The workbook globals name each sheet and give the offset its own
 * records start at, and most text lives once in a shared string table that
 * cells reference by index, as in .xlsx.
 *
 * Only the records the published statistical workbooks actually use are
 * decoded. Anything else is skipped rather than guessed at, so an unsupported
 * feature shows up as a missing value rather than a wrong one.
 */

const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const FREE_SECTOR = 0xffffffff;
const END_OF_CHAIN = 0xfffffffe;
/** Sector numbers at or above this are markers, not sectors. */
const FIRST_MARKER = 0xfffffffa;

const BIFF = {
	FORMULA: 0x0006,
	EOF: 0x000a,
	BLANK: 0x0201,
	NUMBER: 0x0203,
	LABEL: 0x0204,
	BOOLERR: 0x0205,
	STRING: 0x0207,
	ROW: 0x0208,
	BOF: 0x0809,
	BOUNDSHEET: 0x0085,
	MULRK: 0x00bd,
	MULBLANK: 0x00be,
	SST: 0x00fc,
	LABELSST: 0x00fd,
	RK: 0x027e,
	CONTINUE: 0x003c,
} as const;

export interface XlsSheet {
	name: string;
	/** Where this sheet's own records begin in the workbook stream. */
	offset: number;
}

/**
 * Pulls the "Workbook" stream out of the Compound File container.
 *
 * The container keeps a sector allocation table whose own sectors are listed
 * in the header, and, once that list overflows, in a chain of further sectors.
 * A statistical workbook of any size overflows it, so the chain is followed
 * rather than assumed absent.
 */
export function readWorkbookStream(file: Uint8Array): Uint8Array {
	for (const [index, byte] of CFB_SIGNATURE.entries()) {
		if (file[index] !== byte) {
			throw new Error("not a compound file: signature does not match");
		}
	}
	const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
	const sectorSize = 1 << view.getUint16(30, true);
	const fatSectorCount = view.getUint32(44, true);
	const directoryStart = view.getUint32(48, true);
	const difatStart = view.getUint32(68, true);
	const difatSectorCount = view.getUint32(72, true);

	const sectorAt = (sector: number) => {
		const start = 512 + sector * sectorSize;
		return file.subarray(start, start + sectorSize);
	};
	const sectorNumbers = (sector: number) => {
		const bytes = sectorAt(sector);
		const numbers = new DataView(
			bytes.buffer,
			bytes.byteOffset,
			bytes.byteLength,
		);
		return Array.from({ length: sectorSize / 4 }, (_, i) =>
			numbers.getUint32(i * 4, true),
		);
	};

	// The header lists the first 109 sectors of the allocation table; any
	// beyond that are listed in a chain of their own.
	const fatSectors: number[] = [];
	for (let i = 0; i < 109 && fatSectors.length < fatSectorCount; i++) {
		const sector = view.getUint32(76 + i * 4, true);
		if (sector >= FIRST_MARKER) break;
		fatSectors.push(sector);
	}
	let difatSector = difatStart;
	for (
		let seen = 0;
		seen < difatSectorCount && difatSector < FIRST_MARKER;
		seen++
	) {
		const numbers = sectorNumbers(difatSector);
		// The last number in the sector points at the next one.
		for (const sector of numbers.slice(0, -1)) {
			if (sector < FIRST_MARKER) fatSectors.push(sector);
		}
		difatSector = numbers[numbers.length - 1]!;
	}

	const fat: number[] = [];
	for (const sector of fatSectors) fat.push(...sectorNumbers(sector));

	const chain = (start: number) => {
		const sectors: number[] = [];
		let sector = start;
		while (sector < FIRST_MARKER && sector < fat.length) {
			sectors.push(sector);
			const next = fat[sector]!;
			if (next === END_OF_CHAIN || next === FREE_SECTOR) break;
			sector = next;
		}
		return sectors;
	};
	const streamBytes = (start: number, size: number) => {
		const sectors = chain(start);
		const out = new Uint8Array(sectors.length * sectorSize);
		sectors.forEach((sector, i) =>
			out.set(sectorAt(sector), i * sectorSize),
		);
		return out.subarray(0, size);
	};

	const directory = streamBytes(
		directoryStart,
		chain(directoryStart).length * sectorSize,
	);
	for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
		const entry = directory.subarray(offset, offset + 128);
		const entryView = new DataView(
			entry.buffer,
			entry.byteOffset,
			entry.byteLength,
		);
		const nameLength = entryView.getUint16(64, true);
		const name = new TextDecoder("utf-16le").decode(
			entry.subarray(0, Math.max(nameLength - 2, 0)),
		);
		if (name !== "Workbook" && name !== "Book") continue;
		const start = entryView.getUint32(116, true);
		const size = Number(entryView.getBigUint64(120, true));
		if (size < 4096) {
			throw new Error(
				`workbook stream is ${size} bytes, small enough to live in the mini stream, which is not supported`,
			);
		}
		return streamBytes(start, size);
	}
	throw new Error("compound file holds no Workbook stream");
}

/** An RK number: a double with its low four bytes dropped, or a small integer. */
function rkValue(encoded: number): number {
	const hundredths = (encoded & 1) !== 0;
	let value: number;
	if ((encoded & 2) !== 0) {
		value = (encoded | 0) >> 2;
	} else {
		const bytes = new DataView(new ArrayBuffer(8));
		bytes.setUint32(4, encoded & 0xfffffffc, true);
		value = bytes.getFloat64(0, true);
	}
	return hundredths ? value / 100 : value;
}

/**
 * Reads the shared string table, which routinely outgrows the 8,224 byte
 * record ceiling and spills into CONTINUE records. A string may be cut in
 * half by that boundary, and the remainder then starts with a fresh flag byte
 * saying whether its half is stored as one byte per character or two — the
 * two halves need not agree, which is the trap in this format.
 */
function readSharedStrings(fragments: Uint8Array[]): string[] {
	const first = fragments[0];
	if (!first) return [];
	let fragment = 0;
	let offset = 8; // past the total and unique string counts
	const bytes = () => fragments[fragment]!;

	const advance = () => {
		while (fragment < fragments.length && offset >= bytes().length) {
			fragment++;
			offset = 0;
		}
		return fragment < fragments.length;
	};
	const uint8 = () => {
		advance();
		return bytes()[offset++]!;
	};
	const uint16 = () => uint8() | (uint8() << 8);
	const uint32 = () => uint16() | (uint16() << 16);

	const count = new DataView(
		first.buffer,
		first.byteOffset,
		first.byteLength,
	).getUint32(4, true);

	const strings: string[] = [];
	for (let i = 0; i < count && advance(); i++) {
		const length = uint16();
		let flags = uint8();
		let wide = (flags & 1) !== 0;
		const richRuns = (flags & 8) !== 0 ? uint16() : 0;
		const extendedBytes = (flags & 4) !== 0 ? uint32() : 0;

		let text = "";
		let read = 0;
		while (read < length && advance()) {
			// Characters left in this fragment, before its own boundary.
			const available = bytes().length - offset;
			const wanted = length - read;
			const take = Math.min(wanted, wide ? available >> 1 : available);
			if (take > 0) {
				const slice = bytes().subarray(
					offset,
					offset + (wide ? take * 2 : take),
				);
				text += wide
					? new TextDecoder("utf-16le").decode(slice)
					: Array.from(slice, (c) => String.fromCharCode(c)).join("");
				offset += wide ? take * 2 : take;
				read += take;
			}
			if (read < length) {
				// Crossed into the next fragment, which restates the width.
				fragment++;
				offset = 0;
				if (fragment >= fragments.length) break;
				flags = uint8();
				wide = (flags & 1) !== 0;
			}
		}
		for (let run = 0; run < richRuns; run++) uint32();
		for (let skipped = 0; skipped < extendedBytes; skipped++) uint8();
		strings.push(text);
	}
	return strings;
}

/** Every record in the stream, in order, as offsets into it. */
function* records(stream: Uint8Array, from = 0) {
	const view = new DataView(
		stream.buffer,
		stream.byteOffset,
		stream.byteLength,
	);
	let offset = from;
	while (offset + 4 <= stream.length) {
		const type = view.getUint16(offset, true);
		const length = view.getUint16(offset + 2, true);
		const start = offset + 4;
		if (start + length > stream.length) return;
		yield { type, start, length, view };
		offset = start + length;
	}
}

/** The sheets a workbook holds, in the order it lists them. */
export function xlsSheets(stream: Uint8Array): XlsSheet[] {
	const sheets: XlsSheet[] = [];
	for (const { type, start, length, view } of records(stream)) {
		if (type === BIFF.EOF && sheets.length > 0) break;
		if (type !== BIFF.BOUNDSHEET) continue;
		const offset = view.getUint32(start, true);
		const nameLength = stream[start + 6]!;
		const wide = (stream[start + 7]! & 1) !== 0;
		const bytes = stream.subarray(
			start + 8,
			start + 8 + (wide ? nameLength * 2 : nameLength),
		);
		if (start + 8 + bytes.length > start + length + 4) continue;
		sheets.push({
			name: wide
				? new TextDecoder("utf-16le").decode(bytes)
				: Array.from(bytes, (c) => String.fromCharCode(c)).join(""),
			offset,
		});
	}
	return sheets;
}

const numberToCell = (value: number) =>
	Number.isFinite(value) ? String(value) : "";

/**
 * One worksheet as a grid of strings, sized to the cells that carry a value.
 * Numbers are rendered plainly, without the workbook's display formatting, so
 * a reader never has to undo thousands separators or currency symbols.
 */
export function xlsSheetRows(
	stream: Uint8Array,
	sheetName: string,
): string[][] {
	const sheets = xlsSheets(stream);
	const wanted =
		sheets.find((sheet) => sheet.name === sheetName) ??
		sheets.find((sheet) => sheet.name.trim() === sheetName.trim());
	if (!wanted) {
		throw new Error(
			`sheet "${sheetName}" not found; the workbook holds ${sheets
				.map((sheet) => `"${sheet.name}"`)
				.join(", ")}`,
		);
	}

	// The shared string table lives in the globals, before any sheet.
	let sharedStrings: string[] = [];
	const sstFragments: Uint8Array[] = [];
	for (const { type, start, length } of records(stream)) {
		if (type === BIFF.SST) {
			sstFragments.push(stream.subarray(start, start + length));
		} else if (type === BIFF.CONTINUE && sstFragments.length > 0) {
			sstFragments.push(stream.subarray(start, start + length));
		} else if (sstFragments.length > 0 || type === BIFF.EOF) {
			break;
		}
	}
	if (sstFragments.length > 0)
		sharedStrings = readSharedStrings(sstFragments);

	const cells = new Map<number, Map<number, string>>();
	const put = (row: number, column: number, value: string) => {
		if (value === "") return;
		let line = cells.get(row);
		if (!line) cells.set(row, (line = new Map()));
		line.set(column, value);
	};

	let pendingFormula: { row: number; column: number } | null = null;
	for (const { type, start, length, view } of records(
		stream,
		wanted.offset,
	)) {
		if (type === BIFF.EOF) break;
		const row = length >= 2 ? view.getUint16(start, true) : 0;
		const column = length >= 4 ? view.getUint16(start + 2, true) : 0;
		switch (type) {
			case BIFF.LABELSST:
				put(
					row,
					column,
					sharedStrings[view.getUint32(start + 6, true)] ?? "",
				);
				break;
			case BIFF.LABEL: {
				const characters = view.getUint16(start + 6, true);
				const wide = (stream[start + 8]! & 1) !== 0;
				const bytes = stream.subarray(
					start + 9,
					start + 9 + (wide ? characters * 2 : characters),
				);
				put(
					row,
					column,
					wide
						? new TextDecoder("utf-16le").decode(bytes)
						: Array.from(bytes, (c) => String.fromCharCode(c)).join(
								"",
							),
				);
				break;
			}
			case BIFF.NUMBER:
				put(
					row,
					column,
					numberToCell(view.getFloat64(start + 6, true)),
				);
				break;
			case BIFF.RK:
				put(
					row,
					column,
					numberToCell(rkValue(view.getUint32(start + 6, true))),
				);
				break;
			case BIFF.MULRK: {
				// One record carrying a run of numbers across adjacent columns.
				const last = view.getUint16(start + length - 2, true);
				for (let c = column; c <= last; c++) {
					const at = start + 4 + (c - column) * 6;
					put(
						row,
						c,
						numberToCell(rkValue(view.getUint32(at + 2, true))),
					);
				}
				break;
			}
			case BIFF.FORMULA:
				// The cached result follows; a string result arrives separately.
				if ((view.getUint16(start + 12, true) & 0xffff) === 0xffff) {
					pendingFormula = { row, column };
				} else {
					put(
						row,
						column,
						numberToCell(view.getFloat64(start + 6, true)),
					);
				}
				break;
			case BIFF.STRING: {
				if (!pendingFormula) break;
				const characters = view.getUint16(start, true);
				const wide = (stream[start + 2]! & 1) !== 0;
				const bytes = stream.subarray(
					start + 3,
					start + 3 + (wide ? characters * 2 : characters),
				);
				put(
					pendingFormula.row,
					pendingFormula.column,
					wide
						? new TextDecoder("utf-16le").decode(bytes)
						: Array.from(bytes, (c) => String.fromCharCode(c)).join(
								"",
							),
				);
				pendingFormula = null;
				break;
			}
			default:
				break;
		}
	}

	if (cells.size === 0) return [];
	const lastRow = Math.max(...cells.keys());
	const lastColumn = Math.max(
		...[...cells.values()].map((line) => Math.max(...line.keys())),
	);
	return Array.from({ length: lastRow + 1 }, (_, row) => {
		const line = cells.get(row);
		return Array.from(
			{ length: lastColumn + 1 },
			(_, column) => line?.get(column) ?? "",
		);
	});
}
