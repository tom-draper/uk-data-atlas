/** Split one CSV line, honouring double-quoted fields. */
export const csvFields = (line: string) => {
	const fields: string[] = [];
	let field = "";
	let quoted = false;
	for (let index = 0; index < line.length; index += 1) {
		const character = line[index]!;
		if (quoted) {
			if (character === '"' && line[index + 1] === '"') {
				field += '"';
				index += 1;
			} else if (character === '"') quoted = false;
			else field += character;
		} else if (character === '"') quoted = true;
		else if (character === ",") {
			fields.push(field);
			field = "";
		} else field += character;
	}
	fields.push(field);
	return fields;
};

/**
 * Split CSV text into records of fields. A line break inside a quoted field
 * stays in the field rather than ending the record.
 */
export const csvRecords = (text: string) => {
	const records: string[][] = [];
	let start = 0;
	let quoted = false;
	for (let index = 0; index <= text.length; index += 1) {
		const character = text[index];
		if (character === '"') quoted = !quoted;
		else if (
			index === text.length ||
			(!quoted && (character === "\n" || character === "\r"))
		) {
			const line = text.slice(start, index);
			if (line.trim().length > 0) records.push(csvFields(line));
			if (character === "\r" && text[index + 1] === "\n") index += 1;
			start = index + 1;
		}
	}
	return records;
};
