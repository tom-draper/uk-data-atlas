import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * An append-only registry of integer ids for natural keys.
 *
 * Line N of the file (not counting comments) is the key of id `first + N - 1`.
 * Ids are therefore never stored: they are positions, and the only way to
 * change one is to edit a line that is already there, which `git diff` shows
 * and `checkAppendOnly` refuses. A key is assigned once and keeps its id
 * whatever the inventory around it does, so a key that stops being built
 * leaves a gap that is never reused.
 *
 * A key is a list of text fields. Lines hold the last field only, so that a
 * long run of codes in one release costs the code and a newline: a line
 * starting with `@` sets the other fields (tab separated) for the lines that
 * follow. Lines starting with `#` are comments.
 *
 * ```
 * # area_version
 * @lad	2024-12-bgc
 * E06000001
 * E06000002
 * ```
 */

const ESCAPED = /[\t\n\r]/;

type Run = {
	/** The key fields before the last, joined by tabs. */
	prefix: string;
	/** The id of the run's first line. */
	start: number;
	count: number;
	/** The run's lines in the loaded text, else the codes added since. */
	slice?: readonly [from: number, to: number];
	codes?: string[];
	/** Appended to the file by `save()`. */
	saved?: boolean;
};

/** How many prefixes keep a lookup table at once. */
const INDEXED_PREFIXES = 6;

export class IdRegistry {
	readonly name: string;
	/** The id of the first line. */
	readonly first: number;
	/** The number of fields in a key. */
	readonly fields: number;
	private readonly text: string;
	private readonly runs: Run[] = [];
	private readonly runsOf = new Map<string, number[]>();
	private readonly indexes = new Map<string, Map<string, number>>();
	private next: number;
	private readonly loaded: number;
	private frozen: boolean;
	/** What `save()` has appended to the text it loaded. */
	private written = "";

	constructor(
		name: string,
		options: {
			first: number;
			fields: number;
			text?: string;
			frozen?: boolean;
		},
	) {
		this.name = name;
		this.first = options.first;
		this.fields = options.fields;
		this.text = options.text ?? "";
		this.frozen = options.frozen ?? false;
		this.next = this.first;
		this.parse();
		this.loaded = this.next;
	}

	private parse() {
		let prefix = "";
		let run: Run | undefined;
		let offset = 0;
		const seenPrefixes = new Set<string>();
		const finish = (end: number) => {
			if (run) {
				run.slice = [run.slice![0], end];
				this.addRun(run);
			}
			run = undefined;
		};
		while (offset < this.text.length) {
			const newline = this.text.indexOf("\n", offset);
			if (newline === -1)
				throw new Error(
					`Id registry ${this.name} does not end with a newline`,
				);
			const line = this.text.slice(offset, newline);
			const lineEnd = newline + 1;
			if (line.startsWith("#")) {
				// A comment ends a run, so a slice holds only code lines.
				finish(offset);
			} else if (line.startsWith("@")) {
				finish(offset);
				prefix = line.slice(1);
				if (
					(prefix === "" ? 0 : prefix.split("\t").length) !==
					this.fields - 1
				)
					throw new Error(
						`Id registry ${this.name} line has the wrong number of key fields: ${JSON.stringify(line)}`,
					);
				seenPrefixes.add(prefix);
			} else {
				if (line === "" || line.includes("\r"))
					throw new Error(
						`Id registry ${this.name} has a blank or malformed line after id ${this.next - 1}`,
					);
				if (this.fields > 1 && !seenPrefixes.size)
					throw new Error(
						`Id registry ${this.name} has a key before its first @ line`,
					);
				if (!run)
					run = {
						prefix,
						start: this.next,
						count: 0,
						slice: [offset, offset],
					};
				run.count++;
				this.next++;
			}
			offset = lineEnd;
		}
		finish(offset);
		this.checkUnique();
	}

	private checkUnique() {
		// Duplicates are found one prefix at a time, so a registry of a million
		// codes never holds more than one release's lookup table.
		for (const prefix of this.runsOf.keys()) {
			const seen = new Set<string>();
			for (const index of this.runsOf.get(prefix)!)
				for (const code of this.codesOf(this.runs[index]!)) {
					if (seen.has(code))
						throw new Error(
							`Id registry ${this.name} lists ${this.describe(prefix, code)} twice, so it would have two ids`,
						);
					seen.add(code);
				}
		}
	}

	private describe(prefix: string, code: string) {
		return [...(prefix === "" ? [] : prefix.split("\t")), code].join("/");
	}

	private addRun(run: Run) {
		this.runs.push(run);
		const list = this.runsOf.get(run.prefix);
		if (list) list.push(this.runs.length - 1);
		else this.runsOf.set(run.prefix, [this.runs.length - 1]);
	}

	private codesOf(run: Run): string[] {
		if (run.codes) return run.codes;
		const [from, to] = run.slice!;
		return this.text.slice(from, to - 1).split("\n");
	}

	private split(key: readonly string[]) {
		if (key.length !== this.fields)
			throw new Error(
				`Id registry ${this.name} keys have ${this.fields} fields, not ${key.length}`,
			);
		for (const [index, field] of key.entries())
			if (field === "" || ESCAPED.test(field))
				throw new Error(
					`Id registry ${this.name} cannot hold ${JSON.stringify(field)}: keys are not empty and have no tabs or line breaks`,
				);
			else if (
				index === key.length - 1 &&
				(field.startsWith("@") || field.startsWith("#"))
			)
				throw new Error(
					`Id registry ${this.name} cannot hold ${JSON.stringify(field)}: the last field cannot start with @ or #`,
				);
		return {
			prefix: key.slice(0, -1).join("\t"),
			code: key[key.length - 1]!,
		};
	}

	private indexOf(prefix: string) {
		let index = this.indexes.get(prefix);
		if (index) {
			// Most recently used last.
			this.indexes.delete(prefix);
			this.indexes.set(prefix, index);
			return index;
		}
		index = new Map();
		for (const at of this.runsOf.get(prefix) ?? []) {
			const run = this.runs[at]!;
			for (const [offset, code] of this.codesOf(run).entries())
				index.set(code, run.start + offset);
		}
		this.indexes.set(prefix, index);
		if (this.indexes.size > INDEXED_PREFIXES)
			this.indexes.delete(this.indexes.keys().next().value!);
		return index;
	}

	/** The key's id, or undefined if it was never assigned one. */
	id(...key: string[]): number | undefined {
		const { prefix, code } = this.split(key);
		return this.indexOf(prefix).get(code);
	}

	/** The key's id, assigning the next one if it has none. */
	assign(...key: string[]): number {
		const { prefix, code } = this.split(key);
		const index = this.indexOf(prefix);
		const existing = index.get(code);
		if (existing !== undefined) return existing;
		if (this.frozen)
			throw new Error(
				`Id registry ${this.name} has no id for ${key.join("/")}. Build locally to extend pipeline/ids and commit the new lines.`,
			);
		const id = this.next++;
		const last = this.runs[this.runs.length - 1];
		if (last?.codes && !last.saved && last.prefix === prefix) {
			last.codes.push(code);
			last.count++;
		} else this.addRun({ prefix, start: id, count: 1, codes: [code] });
		index.set(code, id);
		return id;
	}

	/** The key an id was assigned to. */
	keyOf(id: number): string[] | undefined {
		for (const run of this.runs)
			if (id >= run.start && id < run.start + run.count)
				return [
					...(run.prefix === "" ? [] : run.prefix.split("\t")),
					this.codesOf(run)[id - run.start]!,
				];
		return undefined;
	}

	/** Every id and key, in id order. */
	*entries(): Generator<{ id: number; key: string[] }> {
		for (const run of this.runs) {
			const prefix = run.prefix === "" ? [] : run.prefix.split("\t");
			for (const [offset, code] of this.codesOf(run).entries())
				yield { id: run.start + offset, key: [...prefix, code] };
		}
	}

	/** How many ids have been assigned, including those not in use. */
	get size() {
		return this.next - this.first;
	}

	/** How many ids this run added to those the file held. */
	get added() {
		return this.next - this.loaded;
	}

	/** The lines to append to the file for ids added since it was loaded. */
	pendingText(): string {
		let out = "";
		let prefix: string | undefined;
		for (const run of this.runs) {
			if (run.slice || run.saved) continue;
			// The file ends in whatever prefix its last written run had.
			if (prefix === undefined) prefix = this.lastWrittenPrefix();
			if (run.prefix !== prefix) {
				out += `@${run.prefix}\n`;
				prefix = run.prefix;
			}
			out += `${run.codes!.join("\n")}\n`;
		}
		return out;
	}

	private lastWrittenPrefix() {
		let prefix = "";
		for (const run of this.runs)
			if (run.slice || run.saved) prefix = run.prefix;
		return prefix;
	}

	/** Append what was added to the file, creating it with a header if need be. */
	save(path: string) {
		const pending = this.pendingText();
		const known = this.text + this.written;
		if (pending === "" && existsSync(path)) return;
		if (!existsSync(path)) {
			mkdirSync(dirname(path), { recursive: true });
			if (known !== "")
				throw new Error(
					`Id registry ${this.name} was loaded from a file that is gone`,
				);
		} else if (readFileSync(path, "utf8") !== known)
			throw new Error(
				`Id registry ${path} changed while it was in use. Rebuild so no ids are lost.`,
			);
		const header = known === "" ? this.header() : "";
		appendFileSync(path, header + pending);
		this.written += header + pending;
		for (const run of this.runs) if (run.codes) run.saved = true;
	}

	header() {
		return `# ${this.name}: id registry. The ${this.fields === 1 ? "key" : `key (${this.fields} fields)`} on line N below is id ${this.first} + N - 1.\n# Append only. Never edit, reorder, remove or reuse a line. See docs/stable-ids.md.\n`;
	}
}

/**
 * Whether `current` only adds lines to `previous`: the same header and the
 * same key lines in the same order, then more. This is the rule that keeps
 * ids stable across commits.
 */
export const checkAppendOnly = (previous: string, current: string) =>
	current.startsWith(previous) &&
	(previous === "" || previous.endsWith("\n"));
