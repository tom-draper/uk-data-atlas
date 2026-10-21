import { surfaceFingerprint } from "@uk-data-atlas/catalogue/surface-fingerprint";
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
 *
 * During early access clients are told to expect breaks (services/api/DIRECTION.md,
 * "Early access, so nothing is frozen yet"), so `--before-launch` locks a
 * breaking change deliberately, listing what it breaks. Remove the flag when
 * v1 is frozen.
 *
 * Every locked change needs a docs changelog entry carrying the new surface's
 * fingerprint. tests/docs/changelog.test.ts fails until it has one.
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
	const beforeLaunch = process.argv.includes("--before-launch");
	if (breaks.length > 0 && beforeLaunch)
		console.warn(
			`Locking breaking changes to v1 before launch:\n${breaks.map((line) => `- ${line}`).join("\n")}`,
		);
	else if (breaks.length > 0) {
		console.error(
			`Refusing to lock a breaking change to v1:\n${breaks.map((line) => `- ${line}`).join("\n")}\nBefore launch, a deliberate break is locked with --before-launch.`,
		);
		process.exit(1);
	}
	const rendered = renderSurface(current);
	const changed = !locked || renderSurface(locked) !== rendered;
	writeFileSync(surfacePath, rendered);
	console.log(
		`Locked ${Object.keys(current.operations).length} v1 operations in ${surfacePath}`,
	);
	if (changed)
		console.log(
			`The surface changed. Add an entry to lib/docs/content/changelog.ts with surface: "${surfaceFingerprint(rendered)}".`,
		);
}
