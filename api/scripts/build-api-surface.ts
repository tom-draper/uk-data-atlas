import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import {
	breakingChanges,
	extractSurface,
	type ApiSurface,
} from "../src/apiSurface";

/**
 * Locks the v1 surface after an additive change to `openapi.yaml`. It refuses
 * to lock a breaking change: that is what the lock exists to stop.
 */
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const surfacePath = resolve(apiRoot, "contract", "v1-surface.json");

export const currentSurface = () =>
	extractSurface(
		parse(readFileSync(resolve(apiRoot, "openapi.yaml"), "utf8")),
	);

export const renderSurface = (surface: ApiSurface) =>
	`${JSON.stringify(surface, null, "\t")}\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const current = currentSurface();
	let locked: ApiSurface | undefined;
	try {
		locked = JSON.parse(readFileSync(surfacePath, "utf8")) as ApiSurface;
	} catch {
		locked = undefined;
	}
	const breaks = locked
		? breakingChanges(
				locked,
				current,
				new Date().toISOString().slice(0, 10),
			)
		: [];
	if (breaks.length > 0) {
		console.error(
			`Refusing to lock a breaking change to v1:\n${breaks.map((line) => `- ${line}`).join("\n")}`,
		);
		process.exit(1);
	}
	writeFileSync(surfacePath, renderSurface(current));
	console.log(
		`Locked ${Object.keys(current.operations).length} v1 operations in ${surfacePath}`,
	);
}
