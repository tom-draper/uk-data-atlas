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
	const componentRoot = openComponentApiRoot(root, component);
	try {
		return read(componentRoot.apiRoot);
	} finally {
		componentRoot.close();
	}
}

export function openComponentApiRoot(root: string, component: string) {
	const temporary = mkdtempSync(join(tmpdir(), "atlas-component-"));
	try {
		const directory = join(temporary, "data/build");
		mkdirSync(directory, { recursive: true });
		symlinkSync(
			resolve(root, "data/build", component),
			join(directory, "atlas.sqlite"),
		);
		return {
			apiRoot: apiRootOf(temporary),
			close: () => rmSync(temporary, { recursive: true, force: true }),
		};
	} catch (error) {
		rmSync(temporary, { recursive: true, force: true });
		throw error;
	}
}
