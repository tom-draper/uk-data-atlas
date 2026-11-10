import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Whether the module at `moduleUrl` (pass `import.meta.url`) is the script
 * node was started with, as opposed to being imported by another module or a
 * test. Lets a build script export its functions and still run when invoked.
 */
export const isMainModule = (moduleUrl: string) =>
	Boolean(process.argv[1]) &&
	resolve(process.argv[1]!) === fileURLToPath(moduleUrl);
