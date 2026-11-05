import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";

/**
 * Text stored as a Brotli blob in a SQLite column.
 *
 * The atlas database keeps large JSON payloads such as the relationship
 * paths. Brotli at quality 9 shrinks them by about 99% in tens of
 * milliseconds, and decodes about twice as fast as gzip. Quality 11 does no
 * better on the largest payload and takes a hundred times as long. Dense
 * numeric text such as geometry gains much more from quality 10, so callers
 * may ask for it. The same input always stores the same bytes.
 */
export function packText(text: string, quality = 9): Buffer {
	const input = Buffer.from(text, "utf8");
	return brotliCompressSync(input, {
		params: {
			[constants.BROTLI_PARAM_QUALITY]: quality,
			[constants.BROTLI_PARAM_SIZE_HINT]: input.length,
		},
	});
}

/**
 * The text of a stored column value. A blob is decompressed. Text is
 * returned as it is, so a column written before compression, or by a
 * writer that keeps plain text, reads the same way. Anything else is not a
 * stored text, and gives undefined.
 */
export function unpackText(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	if (value instanceof Uint8Array)
		return brotliDecompressSync(value).toString("utf8");
	return undefined;
}
