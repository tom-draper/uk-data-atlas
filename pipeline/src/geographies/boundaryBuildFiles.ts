import { parseScriptArgs } from "../lib/args.ts";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const writeAtomically = async (path: string, contents: string) => {
	// Generated release folders may not exist yet.
	await mkdir(dirname(path), { recursive: true });
	const temporaryPath = `${path}.${process.pid}.tmp`;
	await writeFile(temporaryPath, contents);
	await rename(temporaryPath, path);
};

export const exists = async (path: string) => {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
};

export const shouldCompile = async (
	inputPaths: string[],
	outputPath: string,
) => {
	if (parseScriptArgs({ force: { type: "boolean" } }).values.force === true)
		return true;
	try {
		const [output, ...inputs] = await Promise.all(
			[outputPath, ...inputPaths].map((path) => stat(path)),
		);
		return inputs.some((input) => input.mtimeMs > output!.mtimeMs);
	} catch {
		return true;
	}
};
