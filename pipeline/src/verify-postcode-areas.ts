import { buildLog, formatCount } from "@uk-data-atlas/atlas-runtime/storage";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPostcodeAreas } from "./checks/verifyPostcodeAreas.ts";
import { writeStageStamp } from "./storage/stageStamp.ts";

/**
 * The `verify-postcode-areas` check stage: a sample of the stored postcode
 * placements, and every postcode in several areas, match a live lookup.
 */
const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const root = resolve(dirname(scriptPath), "../..");
	const { releases, checked } = verifyPostcodeAreas(root);
	writeStageStamp(root, "verify-postcode-areas", {
		releases: String(releases),
		checked: String(checked),
	});
	buildLog.info(
		`${formatCount(checked)} postcodes in ${formatCount(releases)} releases match a live lookup`,
	);
}
