/**
 * A small, forgiving XML reader for the two spreadsheet formats. It reports
 * elements and text as it goes, so a large sheet is never built into a tree.
 * Entities other than the five XML ones and numeric references are left as
 * written, and a document type that declares entities is refused, so a file
 * cannot expand into something larger than it is.
 */

export type Attributes = Record<string, string>;

export interface XmlHandler {
	open(name: string, attributes: Attributes): void;
	close(name: string): void;
	text(text: string): void;
}

const NAMED: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
};

export function decodeEntities(text: string): string {
	if (!text.includes("&")) return text;
	return text.replace(
		/&(#x[0-9a-fA-F]+|#\d+|\w+);/g,
		(match, body: string) => {
			if (body[0] !== "#") return NAMED[body] ?? match;
			const code =
				body[1] === "x"
					? Number.parseInt(body.slice(2), 16)
					: Number.parseInt(body.slice(1), 10);
			return code > 0 && code <= 0x10ffff
				? String.fromCodePoint(code)
				: match;
		},
	);
}

const ATTRIBUTE = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function readAttributes(body: string): Attributes {
	const attributes: Attributes = {};
	if (!body.includes("=")) return attributes;
	ATTRIBUTE.lastIndex = 0;
	for (let match = ATTRIBUTE.exec(body); match; match = ATTRIBUTE.exec(body))
		attributes[match[1]] = decodeEntities(match[2] ?? match[3] ?? "");
	return attributes;
}

/** The end of the tag that starts at `start`, allowing `>` inside quotes. */
function tagEnd(xml: string, start: number): number {
	let quote = "";
	for (let i = start; i < xml.length; i++) {
		const char = xml[i];
		if (quote) {
			if (char === quote) quote = "";
		} else if (char === '"' || char === "'") quote = char;
		else if (char === ">") return i;
	}
	return -1;
}

/** Drops a namespace prefix: `x:row` becomes `row`. */
export const localName = (name: string) => name.slice(name.indexOf(":") + 1);

export function parseXml(
	xml: string,
	handler: XmlHandler,
	options: { localNames?: boolean } = {},
): void {
	const rename = options.localNames ? localName : (name: string) => name;
	let i = 0;
	while (i < xml.length) {
		const lt = xml.indexOf("<", i);
		if (lt === -1) {
			if (i < xml.length) handler.text(decodeEntities(xml.slice(i)));
			return;
		}
		if (lt > i) handler.text(decodeEntities(xml.slice(i, lt)));

		if (xml.startsWith("<!--", lt)) {
			const end = xml.indexOf("-->", lt + 4);
			if (end === -1) throw new Error("The file's XML is cut short.");
			i = end + 3;
		} else if (xml.startsWith("<![CDATA[", lt)) {
			const end = xml.indexOf("]]>", lt + 9);
			if (end === -1) throw new Error("The file's XML is cut short.");
			handler.text(xml.slice(lt + 9, end));
			i = end + 3;
		} else if (xml.startsWith("<?", lt)) {
			const end = xml.indexOf("?>", lt + 2);
			if (end === -1) throw new Error("The file's XML is cut short.");
			i = end + 2;
		} else if (xml.startsWith("<!", lt)) {
			// A document type may carry entity declarations; refuse those.
			const end = tagEnd(xml, lt + 2);
			if (end === -1) throw new Error("The file's XML is cut short.");
			const declaration = xml.slice(lt, end + 1);
			if (declaration.includes("[") || /<!ENTITY/i.test(declaration))
				throw new Error("The file's XML declares entities.");
			i = end + 1;
		} else if (xml[lt + 1] === "/") {
			const end = xml.indexOf(">", lt + 2);
			if (end === -1) throw new Error("The file's XML is cut short.");
			handler.close(rename(xml.slice(lt + 2, end).trim()));
			i = end + 1;
		} else {
			const end = tagEnd(xml, lt + 1);
			if (end === -1) throw new Error("The file's XML is cut short.");
			const selfClosing = xml[end - 1] === "/";
			const inner = xml.slice(lt + 1, selfClosing ? end - 1 : end);
			const space = inner.search(/\s/);
			const name = rename(space === -1 ? inner : inner.slice(0, space));
			handler.open(
				name,
				space === -1 ? {} : readAttributes(inner.slice(space)),
			);
			if (selfClosing) handler.close(name);
			i = end + 1;
		}
	}
}
