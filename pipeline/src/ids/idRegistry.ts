/**
 * An append-only registry of integer ids for natural keys.
 *
 * A registry is text. Each line that is not a directive holds the last field
 * of one key, and takes the id after the line before it, from the registry's
 * first id. Ids are therefore never stored beside their keys: they are
 * positions, and the only way to change one is to edit a line that is already
 * there, which `git diff` shows and `checkAppendOnly` refuses. A key is
 * assigned once and keeps its id whatever the inventory around it does, so a
 * key that stops being built leaves a gap that is never reused.
 *
 * A key is a list of text fields. Lines hold the last field only, so that a
 * long run of codes in one release costs the code and a newline. Directives:
 *
 * - `@a<TAB>b` sets the other fields of the keys that follow;
 * - `=N` sets the id of the next key, for text that does not continue the
 *   ids before it (the first line of a segmented registry's file);
 * - `#` starts a comment.
 *
 * ```
 * # area_version
 * @lad	2024-12-bgc
 * =980727
 * E06000001
 * E06000002
 * ```
 *
 * A registry is one text, or, if segmented, many: each file was written once
 * and is never changed, so a new release adds a file. The files together must
 * hold every id from the first to the last exactly once, so a file deleted or
 * copied is found at load.
 */

const ESCAPED = /[\t\n\r]/;

export type RegistryFile = { name: string; text: string };

type Run = {
	/** The key fields before the last, joined by tabs. */
	prefix: string;
	/** The id of the run's first line. */
	start: number;
	count: number;
	/** The loaded file the run's lines are in, with their place in its text. */
	file?: number;
	slice?: readonly [from: number, to: number];
	/** The codes added since loading. */
	codes?: string[];
	/** What names the file a new run is written to. */
	group?: string;
	/** Written out by the store. */
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
	/** Whether new keys go to new files rather than the end of one. */
	readonly segmented: boolean;
	private readonly files: RegistryFile[];
	private runs: Run[] = [];
	private readonly runsOf = new Map<string, number[]>();
	private readonly indexes = new Map<string, Map<string, number>>();
	private next: number;
	private readonly loaded: number;
	private readonly frozen: boolean;

	constructor(
		name: string,
		options: {
			first: number;
			fields: number;
			/** One text, for a registry that is a single file. */
			text?: string;
			/** The files of a segmented registry. */
			files?: RegistryFile[];
			segmented?: boolean;
			frozen?: boolean;
		},
	) {
		this.name = name;
		this.first = options.first;
		this.fields = options.fields;
		this.segmented = options.segmented ?? false;
		this.frozen = options.frozen ?? false;
		this.files =
			options.files ??
			(options.text === undefined
				? []
				: [{ name: `${name}.txt`, text: options.text }]);
		this.next = this.first;
		for (const [index, file] of this.files.entries())
			this.parse(index, file);
		this.tile();
		this.checkUnique();
		this.loaded = this.next;
	}

	private parse(fileIndex: number, file: RegistryFile) {
		const where = `Id registry ${this.name} file ${file.name}`;
		const { text } = file;
		let prefix = "";
		let run: Run | undefined;
		let offset = 0;
		let seenPrefix = this.fields === 1;
		// A single file continues from the first id; a segment says where it starts.
		let expected: number | undefined = this.segmented
			? undefined
			: this.first;
		const finish = (end: number) => {
			if (run) {
				run.slice = [run.slice![0], end];
				this.runs.push(run);
			}
			run = undefined;
		};
		while (offset < text.length) {
			const newline = text.indexOf("\n", offset);
			if (newline === -1)
				throw new Error(`${where} does not end with a newline`);
			const line = text.slice(offset, newline);
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
						`${where} line has the wrong number of key fields: ${JSON.stringify(line)}`,
					);
				seenPrefix = true;
			} else if (line.startsWith("=")) {
				finish(offset);
				const id = Number(line.slice(1));
				if (!Number.isInteger(id) || id < this.first)
					throw new Error(
						`${where} has a bad id line ${JSON.stringify(line)}`,
					);
				expected = id;
			} else {
				if (line === "" || line.includes("\r"))
					throw new Error(
						`${where} has a blank or malformed line after id ${(expected ?? this.first) - 1}`,
					);
				if (!seenPrefix)
					throw new Error(
						`${where} has a key before its first @ line`,
					);
				if (expected === undefined)
					throw new Error(
						`${where} has a key before its first = line, which gives its id`,
					);
				if (!run)
					run = {
						prefix,
						start: expected,
						count: 0,
						file: fileIndex,
						slice: [offset, offset],
					};
				run.count++;
				expected++;
			}
			offset = newline + 1;
		}
		finish(offset);
	}

	/** Every id from the first to the last is in exactly one place. */
	private tile() {
		this.runs.sort((a, b) => a.start - b.start);
		let cursor = this.first;
		for (const run of this.runs) {
			if (run.start < cursor)
				throw new Error(
					`Id registry ${this.name} gives id ${run.start} to more than one key (${this.files[run.file!]!.name}): a file was copied or edited`,
				);
			if (run.start > cursor)
				throw new Error(
					`Id registry ${this.name} is missing ids ${cursor} to ${run.start - 1}: a file was deleted or not committed`,
				);
			cursor = run.start + run.count;
		}
		this.next = cursor;
		for (const [index, run] of this.runs.entries())
			this.listRun(run, index);
	}

	private listRun(run: Run, index: number) {
		const list = this.runsOf.get(run.prefix);
		if (list) list.push(index);
		else this.runsOf.set(run.prefix, [index]);
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

	private codesOf(run: Run): string[] {
		if (run.codes) return run.codes;
		const [from, to] = run.slice!;
		return this.files[run.file!]!.text.slice(from, to - 1).split("\n");
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
			else if (index === key.length - 1 && /^[@#=]/.test(field))
				throw new Error(
					`Id registry ${this.name} cannot hold ${JSON.stringify(field)}: the last field cannot start with @, # or =`,
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
		return this.assignIn(undefined, ...key);
	}

	/**
	 * The key's id, assigning the next one if it has none. A new key is
	 * written to the file `group` names (a path such as `ward/2024-12`),
	 * which by default is the key's own prefix: a segmented registry's keys
	 * for one release go to one file. The group of a key that has an id does
	 * not matter.
	 */
	assignIn(group: string | undefined, ...key: string[]): number {
		const { prefix, code } = this.split(key);
		const index = this.indexOf(prefix);
		const existing = index.get(code);
		if (existing !== undefined) return existing;
		if (this.frozen)
			throw new Error(
				`Id registry ${this.name} has no id for ${key.join("/")}. Build locally to extend pipeline/ids and commit the new lines.`,
			);
		const where = this.segmented
			? (group ?? prefix.split("\t").join("/"))
			: "";
		const id = this.next++;
		const last = this.runs[this.runs.length - 1];
		if (
			last?.codes &&
			!last.saved &&
			last.prefix === prefix &&
			last.group === where
		) {
			last.codes.push(code);
			last.count++;
		} else {
			const run = {
				prefix,
				start: id,
				count: 1,
				codes: [code],
				group: where,
			};
			this.runs.push(run);
			this.listRun(run, this.runs.length - 1);
		}
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

	/** How many ids this run added to those the files held. */
	get added() {
		return this.next - this.loaded;
	}

	/**
	 * The text to write for the ids added and not yet saved, by the file it
	 * goes to (`""` for a registry that is one file, which it is appended to).
	 */
	pending(): { group: string; text: string }[] {
		const groups = new Map<string, Run[]>();
		for (const run of this.runs) {
			if (!run.codes || run.saved) continue;
			const list = groups.get(run.group!);
			if (list) list.push(run);
			else groups.set(run.group!, [run]);
		}
		return [...groups].map(([group, runs]) => {
			let text = "";
			let prefix: string | undefined = this.segmented
				? this.fields === 1
					? ""
					: undefined
				: this.lastWrittenPrefix();
			let end: number | undefined = this.segmented
				? undefined
				: runs[0]!.start;
			for (const run of runs) {
				if (run.prefix !== prefix) {
					text += `@${run.prefix}\n`;
					prefix = run.prefix;
				}
				if (run.start !== end) text += `=${run.start}\n`;
				text += `${run.codes!.join("\n")}\n`;
				end = run.start + run.count;
			}
			return { group, text };
		});
	}

	private lastWrittenPrefix() {
		let prefix = "";
		for (const run of this.runs)
			if (!run.codes || run.saved) prefix = run.prefix;
		return prefix;
	}

	/** Record that the store has written everything `pending()` gave. */
	markSaved() {
		for (const run of this.runs) if (run.codes) run.saved = true;
	}

	header(file = "") {
		return `# ${this.name}${file ? ` ${file}` : ""}: id registry. ${this.fields === 1 ? "A key" : `A key (${this.fields} fields)`} is on each line below that is not a directive, and its id is the one after the line before it, from ${this.first}.\n# Append only${this.segmented ? ": a file is written once and never changed" : ""}. Never edit, reorder, remove or reuse a line. See docs/stable-ids.md.\n`;
	}
}

/**
 * Whether `current` only adds lines to `previous`: the same header and the
 * same key lines in the same order, then more. This is the rule that keeps
 * ids stable across commits for a registry that is one file.
 */
export const checkAppendOnly = (previous: string, current: string) =>
	current.startsWith(previous) &&
	(previous === "" || previous.endsWith("\n"));
