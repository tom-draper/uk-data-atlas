import { performance } from "node:perf_hooks";
import { join } from "node:path";
import { compileAreaOverlapCrosswalk } from "../../shared/areaOverlap";
import { readCrosswalkAdapters } from "../../shared/crosswalkAdapters";
import { readCompiledAreaLookup } from "../../shared/crosswalk-build-inputs";
import {
	apiRootOf,
	artifactDirectory,
	configDirectory,
} from "../../shared/dataLayout";
import { readGeometrySourceLookup } from "../../shared/geometrySources";
import { readStoredText } from "../../shared/storedText";
import type { AreaOverlapCrosswalkArtifact } from "../../shared/crosswalkTypes";

const root = process.cwd();
const id =
	process.argv[2] ??
	"national-park-2020-12-gb-bgc-to-local-authority-2020-12-uk-bgc-area-overlap";
const adapter = readCrosswalkAdapters(
	join(configDirectory(root), "crosswalk-adapters.json"),
).find((entry) => entry.id === id);
if (!adapter || adapter.method !== "area-overlap")
	throw new Error(`Unknown area-overlap crosswalk: ${id}`);
const output = artifactDirectory(root);
const reference = JSON.parse(
	readStoredText(join(output, "crosswalks", `${id}.json`)),
) as AreaOverlapCrosswalkArtifact;
const lookup = readCompiledAreaLookup(output).areaLookup;
const sources = readGeometrySourceLookup(apiRootOf(root));
const started = performance.now();
const compiled = compileAreaOverlapCrosswalk(root, adapter, sources, lookup);
console.log(
	JSON.stringify(
		{
			id,
			seconds: (performance.now() - started) / 1000,
			peakRssMiB: process.resourceUsage().maxRSS / 1024,
			referenceHash: reference.contentHash,
			compiledHash: compiled.contentHash,
			sameHash: reference.contentHash === compiled.contentHash,
		},
		null,
		2,
	),
);
if (reference.contentHash !== compiled.contentHash) process.exitCode = 1;
