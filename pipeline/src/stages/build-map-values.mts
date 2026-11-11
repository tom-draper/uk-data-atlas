import { join } from "node:path";
import { buildLog } from "@uk-data-atlas/atlas-db";
import { buildMapValues } from "../maps/buildMapValues.ts";
import { ROOT } from "../precompile/paths.ts";

if (import.meta.url === `file://${process.argv[1]}`) {
	const manifest = await buildMapValues({
		datasetsDir: join(ROOT, "data/build/datasets"),
		boundariesDir: join(ROOT, "public/data/boundaries"),
		outDir: join(ROOT, "public/data/map-values"),
	});
	const entries = Object.values(manifest.entries);
	const bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
	buildLog.info(`Wrote ${entries.length} map value arrays, ${bytes} bytes`);
}
