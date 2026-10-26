import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { UsageEvent } from "./usageLabels";

/**
 * Daily usage counts in one small SQLite file, kept outside the release and
 * the response cache so a deploy neither replaces nor invalidates it.
 *
 * A row is a count of requests that shared a UTC day and the same labels (see
 * usageLabels). It holds no request, client or place: only a route template,
 * an outcome, ids from our own catalogue and a number. Workers add their own
 * deltas with an upsert that sums, so any number of processes can write to the
 * same file and the totals are the same whichever order they land in.
 */
export const USAGE_FILE = "usage.sqlite";

export type UsageRow = UsageEvent & {
	/** The UTC date, `YYYY-MM-DD`. */
	day: string;
	requests: number;
};

export type UsageDimension =
	| "route"
	| "outcome"
	| "problem"
	| "measure"
	| "geography"
	| "release"
	| "notFound";

const COLUMNS: Record<UsageDimension, string> = {
	route: "route",
	outcome: "outcome",
	problem: "problem",
	measure: "measure",
	geography: "geography",
	release: "release",
	notFound: "not_found",
};

export type UsageTotal = Partial<Record<UsageDimension, string>> & {
	requests: number;
	/** Requests answered with a 4xx or 5xx. */
	failed: number;
};

/** The labels a template, id or enumeration can contain. */
const LABEL = /^[A-Za-z0-9_.:/{}-]{0,160}$/;
const OTHER = "other";

/**
 * The last line of defence for what reaches disk: a label that is not the
 * shape of a template or catalogue id is stored as `other`, whatever produced
 * it, so a bug upstream cannot write free text into the file.
 */
const safe = (value: string) => (LABEL.test(value) ? value : OTHER);

export const utcDay = (at: number) => new Date(at).toISOString().slice(0, 10);

export class UsageStore {
	private readonly db: DatabaseSync;

	private constructor(db: DatabaseSync) {
		this.db = db;
	}

	/** Open for writing, creating the directory and file when absent. */
	static open(directory: string) {
		mkdirSync(directory, { recursive: true });
		const db = new DatabaseSync(join(directory, USAGE_FILE));
		// WAL lets the report read while workers write; the timeout lets two
		// workers flushing at once take turns instead of failing.
		db.exec("PRAGMA busy_timeout = 5000");
		db.exec("PRAGMA journal_mode = WAL");
		db.exec(`CREATE TABLE IF NOT EXISTS usage_daily (
			day TEXT NOT NULL,
			route TEXT NOT NULL,
			outcome TEXT NOT NULL,
			problem TEXT NOT NULL,
			measure TEXT NOT NULL,
			geography TEXT NOT NULL,
			release TEXT NOT NULL,
			not_found TEXT NOT NULL,
			requests INTEGER NOT NULL,
			PRIMARY KEY (day, route, outcome, problem, measure, geography, release, not_found)
		) WITHOUT ROWID`);
		return new UsageStore(db);
	}

	/** Open an existing file for the report, which never changes it. */
	static openReadOnly(directory: string) {
		const db = new DatabaseSync(join(directory, USAGE_FILE), {
			readOnly: true,
		});
		db.exec("PRAGMA busy_timeout = 5000");
		return new UsageStore(db);
	}

	/** Add counts to their days, in one transaction. */
	add(rows: readonly UsageRow[]) {
		if (rows.length === 0) return;
		const upsert = this.db.prepare(`INSERT INTO usage_daily
			(day, route, outcome, problem, measure, geography, release, not_found, requests)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT DO UPDATE SET requests = requests + excluded.requests`);
		this.db.exec("BEGIN IMMEDIATE");
		try {
			for (const row of rows)
				upsert.run(
					safe(row.day),
					safe(row.route),
					safe(row.outcome),
					safe(row.problem),
					safe(row.measure),
					safe(row.geography),
					safe(row.release),
					safe(row.notFound),
					row.requests,
				);
			this.db.exec("COMMIT");
		} catch (error) {
			this.db.exec("ROLLBACK");
			throw error;
		}
	}

	/** Forget days before `day`. */
	prune(day: string) {
		this.db.prepare("DELETE FROM usage_daily WHERE day < ?").run(day);
	}

	/**
	 * Request counts from `sinceDay` on, grouped by the given dimensions,
	 * largest first. A dimension in `present` must be set, so a measure table
	 * leaves out the routes that name none.
	 */
	totals(
		sinceDay: string,
		groupBy: readonly UsageDimension[],
		options: { present?: readonly UsageDimension[]; limit?: number } = {},
	): UsageTotal[] {
		const columns = groupBy.map((dimension) => COLUMNS[dimension]);
		const present = (options.present ?? []).map(
			(dimension) => `${COLUMNS[dimension]} != ''`,
		);
		const rows = this.db
			.prepare(
				`SELECT ${columns.map((column) => `${column} AS ${column}, `).join("")}
					SUM(requests) AS requests,
					SUM(CASE WHEN outcome IN ('4xx', '5xx') THEN requests ELSE 0 END) AS failed
				FROM usage_daily
				WHERE ${["day >= ?", ...present].join(" AND ")}
				${columns.length ? `GROUP BY ${columns.join(", ")}` : ""}
				ORDER BY requests DESC, ${columns.length ? columns.join(", ") : "1"}
				LIMIT ?`,
			)
			.all(sinceDay, options.limit ?? 20) as Array<
			Record<string, unknown>
		>;
		return rows.map((row) => ({
			...Object.fromEntries(
				groupBy.map((dimension) => [
					dimension,
					String(row[COLUMNS[dimension]]),
				]),
			),
			requests: Number(row.requests),
			failed: Number(row.failed),
		}));
	}

	close() {
		this.db.close();
	}
}
