import { readFileSync } from "node:fs";

/**
 * The feature properties of a GeoJSON FeatureCollection, read without
 * building its geometry. Several build steps need only a release's property
 * table, and parsing the whole file allocates every coordinate pair as its
 * own array: the 261 MB output area release alone becomes gigabytes of heap.
 * This walks the text once, parses each feature's `properties` object on its
 * own and steps over everything else as characters.
 */
export type GeoJsonProperties =
	| { type: "FeatureCollection"; properties: Array<unknown> }
	| { type: "invalid" };

const QUOTE = 34;
const BACKSLASH = 92;
const OPEN_BRACE = 123;
const CLOSE_BRACE = 125;
const OPEN_BRACKET = 91;
const CLOSE_BRACKET = 93;
const COMMA = 44;
const COLON = 58;

const isSpace = (code: number) =>
	code === 32 || code === 10 || code === 13 || code === 9;

class Scanner {
	at = 0;
	constructor(private readonly text: string) {}

	private fail(expected: string): never {
		throw new SyntaxError(
			`Invalid GeoJSON: expected ${expected} at offset ${this.at}.`,
		);
	}

	skipSpace() {
		const { text } = this;
		while (this.at < text.length && isSpace(text.charCodeAt(this.at)))
			this.at += 1;
	}

	peek() {
		this.skipSpace();
		return this.text.charCodeAt(this.at);
	}

	expect(code: number, name: string) {
		if (this.peek() !== code) this.fail(name);
		this.at += 1;
	}

	/** Steps past a string whose opening quote is at the cursor. */
	private skipString() {
		const { text } = this;
		this.at += 1;
		while (this.at < text.length) {
			const code = text.charCodeAt(this.at);
			if (code === BACKSLASH) this.at += 2;
			else if (code === QUOTE) {
				this.at += 1;
				return;
			} else this.at += 1;
		}
		this.fail("the end of a string");
	}

	readString(): string {
		this.skipSpace();
		const start = this.at;
		if (this.text.charCodeAt(start) !== QUOTE) this.fail("a string");
		this.skipString();
		return JSON.parse(this.text.slice(start, this.at)) as string;
	}

	/** Steps past any JSON value, returning where it began and ended. */
	skipValue(): [number, number] {
		this.skipSpace();
		const { text } = this;
		const start = this.at;
		const first = text.charCodeAt(start);
		if (first === QUOTE) {
			this.skipString();
			return [start, this.at];
		}
		if (first === OPEN_BRACE || first === OPEN_BRACKET) {
			let depth = 0;
			while (this.at < text.length) {
				const code = text.charCodeAt(this.at);
				if (code === QUOTE) {
					this.skipString();
					continue;
				}
				if (code === OPEN_BRACE || code === OPEN_BRACKET) depth += 1;
				else if (code === CLOSE_BRACE || code === CLOSE_BRACKET) {
					depth -= 1;
					if (depth === 0) {
						this.at += 1;
						return [start, this.at];
					}
				}
				this.at += 1;
			}
			this.fail("the end of a container");
		}
		// A number, true, false or null runs to the next delimiter.
		while (this.at < text.length) {
			const code = text.charCodeAt(this.at);
			if (
				code === COMMA ||
				code === CLOSE_BRACE ||
				code === CLOSE_BRACKET ||
				isSpace(code)
			)
				break;
			this.at += 1;
		}
		if (this.at === start) this.fail("a value");
		return [start, this.at];
	}

	/** Calls `onKey` for each key of the object at the cursor. */
	eachKey(onKey: (key: string) => void) {
		this.expect(OPEN_BRACE, "{");
		if (this.peek() === CLOSE_BRACE) {
			this.at += 1;
			return;
		}
		for (;;) {
			const key = this.readString();
			this.expect(COLON, ":");
			onKey(key);
			const next = this.peek();
			this.at += 1;
			if (next === CLOSE_BRACE) return;
			if (next !== COMMA) this.fail(", or }");
		}
	}

	/** Calls `onItem` for each element of the array at the cursor. */
	eachItem(onItem: () => void) {
		this.expect(OPEN_BRACKET, "[");
		if (this.peek() === CLOSE_BRACKET) {
			this.at += 1;
			return;
		}
		for (;;) {
			onItem();
			const next = this.peek();
			this.at += 1;
			if (next === CLOSE_BRACKET) return;
			if (next !== COMMA) this.fail(", or ]");
		}
	}

	slice([start, end]: [number, number]) {
		return this.text.slice(start, end);
	}
}

/** Reads the feature properties from GeoJSON text. */
export const parseGeoJsonProperties = (text: string): GeoJsonProperties => {
	const scanner = new Scanner(text);
	if (scanner.peek() !== OPEN_BRACE) return { type: "invalid" };
	let type: unknown;
	let features: unknown[] | undefined;
	scanner.eachKey((key) => {
		if (key === "type") {
			type = JSON.parse(scanner.slice(scanner.skipValue()));
			return;
		}
		if (key !== "features" || scanner.peek() !== OPEN_BRACKET) {
			scanner.skipValue();
			return;
		}
		const found: unknown[] = [];
		scanner.eachItem(() => {
			if (scanner.peek() !== OPEN_BRACE) {
				// Not a feature object; kept as a missing entry so indices
				// still line up with the source's features.
				scanner.skipValue();
				found.push(undefined);
				return;
			}
			let properties: unknown;
			scanner.eachKey((featureKey) => {
				const span = scanner.skipValue();
				if (featureKey === "properties")
					properties = JSON.parse(scanner.slice(span));
			});
			found.push(properties);
		});
		features = found;
	});
	scanner.skipSpace();
	if (scanner.at !== text.length)
		throw new SyntaxError(
			`Invalid GeoJSON: unexpected content at offset ${scanner.at}.`,
		);
	return type === "FeatureCollection" && features
		? { type: "FeatureCollection", properties: features }
		: { type: "invalid" };
};

export const readGeoJsonProperties = (path: string): GeoJsonProperties =>
	parseGeoJsonProperties(readFileSync(path, "utf8"));
