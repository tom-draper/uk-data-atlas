import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { apiRootOf } from "@uk-data-atlas/atlas-runtime/storage";

/** Give existing SQLite readers an isolated root for one build component. */
export function withComponentApiRoot<T>(
	root: string,
	component: string,
	read: (apiRoot: string) => T,
): T {
	const temporary = mkdtempSync(join(tmpdir(), "atlas-component-"));
	try {
		const directory = join(temporary, "data/build");
		mkdirSync(directory, { recursive: true });
		symlinkSync(
			resolve(root, "data/build", component),
			join(directory, "atlas.sqlite"),
		);
		return read(apiRootOf(temporary));
	} finally {
		rmSync(temporary, { recursive: true, force: true });
	}
}
