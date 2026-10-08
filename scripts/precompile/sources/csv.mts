import { execSync, spawn } from "child_process";
import { createHash } from "crypto";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { join } from "path";
import Papa from "papaparse";
import { SOURCE_DATA } from "../paths.mts";

/** Extracts and reads the first CSV from a ZIP in data/. */
export const readZip = (path: string): Promise<string> => {
	const fullPath = join(SOURCE_DATA, path);
	return stat(fullPath).then(() =>
		execSync(`unzip -p "${fullPath}" "*.csv"`, {
			maxBuffer: 100 * 1024 * 1024,
		}).toString("utf8"),
	);
};

export const visitZipCsvRows = async (
	path: string,
	visit: (row: Readonly<Record<string, string>>) => void,
): Promise<{ bytes: number; sha256: string }> => {
	const fullPath = join(SOURCE_DATA, path);
	await stat(fullPath);
	return new Promise((resolve, reject) => {
		const unzip = spawn("unzip", ["-p", fullPath, "*.csv"]);
		if (!unzip.stdout) {
			reject(new Error(`Could not stream ${path}.`));
			return;
		}
		const hash = createHash("sha256");
		let bytes = 0;
		let finished = false;
		let parsed = false;
		let exitCode: number | null | undefined;
		const fail = (error: unknown) => {
			if (finished) return;
			finished = true;
			unzip.kill();
			reject(error);
		};
		const complete = () => {
			if (!parsed || exitCode === undefined || finished) return;
			if (exitCode !== 0) {
				fail(new Error(`Could not stream ${path}.`));
				return;
			}
			finished = true;
			resolve({ bytes, sha256: hash.digest("hex") });
		};
		const parser = Papa.parse<Record<string, string>>(
			Papa.NODE_STREAM_INPUT,
			{ header: true, skipEmptyLines: true },
		);
		unzip.stdout.on("data", (chunk: Buffer) => {
			hash.update(chunk);
			bytes += chunk.byteLength;
		});
		parser.on("data", (row: Record<string, string>) => {
			try {
				visit(row);
			} catch (error) {
				fail(error);
			}
		});
		parser.on("error", fail);
		parser.on("end", () => {
			parsed = true;
			complete();
		});
		unzip.on("error", fail);
		unzip.on("close", (code) => {
			exitCode = code;
			complete();
		});
		unzip.stdout.pipe(parser);
	});
};

export const visitCsvRows = async (
	path: string,
	{ skipLines = 0 }: { skipLines?: number },
	visit: (row: Readonly<Record<string, string>>) => void,
): Promise<{ bytes: number; sha256: string }> => {
	const fullPath = join(SOURCE_DATA, path);
	await stat(fullPath);
	return new Promise((resolve, reject) => {
		const input = createReadStream(fullPath);
		const hash = createHash("sha256");
		let bytes = 0;
		let finished = false;
		const fail = (error: unknown) => {
			if (finished) return;
			finished = true;
			input.destroy();
			reject(error);
		};
		const parser = Papa.parse<Record<string, string>>(
			Papa.NODE_STREAM_INPUT,
			{
				header: true,
				skipEmptyLines: true,
				beforeFirstChunk: (chunk) => {
					let start = 0;
					for (let line = 0; line < skipLines; line++) {
						const end = chunk.indexOf("\n", start);
						if (end === -1) return "";
						start = end + 1;
					}
					return chunk.slice(start);
				},
			},
		);
		input.on("data", (chunk: Buffer) => {
			hash.update(chunk);
			bytes += chunk.byteLength;
		});
		input.on("error", fail);
		parser.on("data", (row: Record<string, string>) => {
			try {
				visit(row);
			} catch (error) {
				fail(error);
			}
		});
		parser.on("error", fail);
		parser.on("end", () => {
			if (finished) return;
			finished = true;
			resolve({ bytes, sha256: hash.digest("hex") });
		});
		input.pipe(parser);
	});
};
