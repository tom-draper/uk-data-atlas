import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { usageReport } from "../src/usageReport";
import { USAGE_FILE, UsageStore } from "../src/usageStore";

/**
 * Prints what the API was asked for, from the daily counts a server keeps
 * when `ATLAS_USAGE_DIR` is set. Run it on the host that holds the directory:
 *
 *   pnpm --dir services/api usage:report --days 30
 *
 * In the container image the same report is `node dist/usage-report.mjs`.
 */
const { values } = parseArgs({
	options: {
		days: { type: "string", default: "30" },
		limit: { type: "string", default: "10" },
		dir: { type: "string" },
	},
});

const positive = (name: string, text: string) => {
	const value = Number(text);
	if (!Number.isInteger(value) || value < 1)
		throw new Error(`--${name} must be a positive whole number.`);
	return value;
};

try {
	const directory = values.dir ?? process.env.ATLAS_USAGE_DIR;
	if (!directory)
		throw new Error(
			"Give --dir, or set ATLAS_USAGE_DIR, to the usage directory.",
		);
	if (!existsSync(join(directory, USAGE_FILE)))
		throw new Error(
			`No ${USAGE_FILE} in ${directory}: no usage has been recorded there.`,
		);
	const days = positive("days", values.days);
	const limit = positive("limit", values.limit);
	const store = UsageStore.openReadOnly(directory);
	try {
		console.log(usageReport(store, { days, limit }));
	} finally {
		store.close();
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
