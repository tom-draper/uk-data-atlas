import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DIRECTION = resolve(__dirname, "../../services/api/DIRECTION.md");

/** `{geography}` and `{measure-id}` are the same slot under any name. */
export const shape = (path: string) => path.replace(/\{[^}]+\}/g, "{}");

/** The routes in DIRECTION.md's "Front door" table, as method-free path shapes. */
export function directionRoutes(): string[] {
	// A `…/history` cell continues the last full path above it, even in an earlier row.
	let last = "";
	const rows = readFileSync(DIRECTION, "utf8")
		.split("### Front door")[1]
		.split(/\n#/)[0]
		.split("\n")
		.filter((line) => line.startsWith("|"))
		.slice(2);
	return rows.flatMap((row) => {
		return [...row.split("|")[2].matchAll(/`([^`]+)`/g)].flatMap(
			([, token]) => {
				const path = /(…)?(\/\S*)/.exec(token);
				if (!path) return [];
				const full = path[1] ? last + path[2] : path[2];
				if (!path[1]) last = full.split("?")[0];
				return [shape(full.split("?")[0])];
			},
		);
	});
}
