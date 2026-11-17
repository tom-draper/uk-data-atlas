import type { DatabaseSync } from "node:sqlite";

/** Check a complete database after its final write and before publication. */
export function checkDatabase(
	database: DatabaseSync,
	check: "integrity_check" | "quick_check" = "integrity_check",
) {
	const groups = new Map<
		string,
		{ child: string; parent: string; count: number; examples: string[] }
	>();
	for (const row of database.prepare("PRAGMA foreign_key_check").iterate()) {
		const child = String(row.table);
		const parent = String(row.parent);
		const key = JSON.stringify([child, parent]);
		const group = groups.get(key) ?? {
			child,
			parent,
			count: 0,
			examples: [],
		};
		group.count++;
		if (group.examples.length < 5)
			group.examples.push(
				row.rowid === null
					? "unavailable (WITHOUT ROWID)"
					: String(row.rowid),
			);
		groups.set(key, group);
	}
	if (groups.size)
		throw new Error(
			`Foreign key check failed: ${[...groups.values()].map(({ child, parent, count, examples }) => `${child} -> ${parent}: ${count} broken row(s), example rowids: ${examples.join(", ")}`).join("; ")}`,
		);
	const results = database.prepare(`PRAGMA ${check}`).all();
	if (results.length !== 1 || results[0]?.[check] !== "ok") {
		const messages = results.slice(0, 5).map((row) => String(row[check]));
		throw new Error(
			`SQLite ${check} failed: ${messages.join("; ") || "no result"}`,
		);
	}
}
