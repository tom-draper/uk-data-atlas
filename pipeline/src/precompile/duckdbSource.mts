import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { fileStamp, sameFileStamp } from "./cache.mts";

export async function trackDuckdbSource(file: string) {
	const before = await fileStamp(file);
	const hash = createHash("sha256");
	let bytes = 0;
	for await (const chunk of createReadStream(file)) {
		hash.update(chunk as Buffer);
		bytes += (chunk as Buffer).length;
	}
	return async () => {
		const input = await fileStamp(file);
		if (!sameFileStamp(before, input) || bytes !== input.bytes)
			throw new Error(`Source changed while reading: ${file}`);
		return { bytes, sha256: hash.digest("hex"), input };
	};
}
