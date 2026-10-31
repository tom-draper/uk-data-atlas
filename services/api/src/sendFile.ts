import { createReadStream } from "node:fs";
import { pipeline } from "node:stream";
import { createGunzip } from "node:zlib";
import type { ServerResponse } from "node:http";
import type { SentFile } from "./httpResponse";

/**
 * Streams a stored file to the client. A client that goes away mid-download,
 * as a map does when it pans past a tile, tears the whole chain down, so the
 * file is closed rather than left open waiting for a reader that never comes.
 */
export const sendFile = (
	file: SentFile,
	response: ServerResponse,
	onComplete?: (error: Error | null | undefined, bytes: number) => void,
) => {
	const source = createReadStream(file.path, {
		start: file.start,
		end: file.end,
	});
	let bytes = 0;
	const decoder = file.gunzip ? createGunzip() : undefined;
	const output = decoder ?? source;
	const done = (error?: Error | null) => {
		if (!error && bytes !== file.bytes)
			error = new Error(
				"Stored file size does not match its declared length.",
			);
		if (error) response.destroy(error);
		onComplete?.(error, bytes);
	};
	if (decoder) pipeline(source, decoder, response, done);
	else pipeline(source, response, done);
	output.on("data", (chunk: Buffer) => {
		bytes += chunk.length;
	});
	return source;
};
