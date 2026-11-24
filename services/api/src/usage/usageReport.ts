import {
	UsageStore,
	utcDay,
	type UsageDimension,
	type UsageTotal,
} from "./usageStore";

/**
 * A plain-text summary of usage over the last `days` UTC days, today
 * included: the routes asked for most, the measures and geographies named,
 * and what was asked for and not found, which is where the gaps are.
 */
export type UsageReportOptions = {
	days: number;
	limit: number;
	now?: number;
};

const table = (
	title: string,
	columns: readonly UsageDimension[],
	rows: readonly UsageTotal[],
) => {
	const cells = rows.map((row) => [
		String(row.requests),
		String(row.failed),
		...columns.map((column) => row[column] || "-"),
	]);
	const header = ["requests", "failed", ...columns];
	const widths = header.map((name, index) =>
		Math.max(name.length, ...cells.map((cell) => cell[index]!.length)),
	);
	const line = (values: readonly string[]) =>
		values
			.map((value, index) =>
				index < 2
					? value.padStart(widths[index]!)
					: value.padEnd(widths[index]!),
			)
			.join("  ")
			.trimEnd();
	return [
		title,
		...(rows.length ? [line(header), ...cells.map(line)] : ["  none"]),
	].join("\n");
};

export const usageReport = (
	store: UsageStore,
	{ days, limit, now = Date.now() }: UsageReportOptions,
) => {
	const since = utcDay(now - (days - 1) * 86_400_000);
	const top = (
		groupBy: readonly UsageDimension[],
		present: readonly UsageDimension[] = [],
	) => store.totals(since, groupBy, { present, limit });
	const [overall] = store.totals(since, []);
	return [
		`API usage from ${since} to ${utcDay(now)} (UTC), ${overall?.requests ?? 0} requests, ${overall?.failed ?? 0} failed`,
		table("Top routes", ["route"], top(["route"])),
		table("Top measures", ["measure"], top(["measure"], ["measure"])),
		table(
			"Top geographies and releases",
			["geography", "release"],
			top(["geography", "release"], ["geography"]),
		),
		table(
			"Top not found (unknown means an id the catalogue does not hold)",
			["notFound", "route", "measure", "geography", "release"],
			top(
				["notFound", "route", "measure", "geography", "release"],
				["notFound"],
			),
		),
	].join("\n\n");
};
