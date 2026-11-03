import { StringDecoder } from "node:string_decoder";

/**
 * Prefixes every line of a child process's output, so a stage's output is
 * grouped under its stage line.
 *
 * `\r` progress updates keep only their final state, unless `overwrite` is
 * set (a terminal), where each update replaces the last one in place. A
 * partial last line is written by `flush`.
 *
 * @param {{ prefix?: string, write: (text: string) => void, overwrite?: boolean }} options
 */
export function createLinePrefixer({
	prefix = "  ",
	write,
	overwrite = false,
}) {
	const decoder = new StringDecoder("utf8");
	let line = "";
	let carriageReturn = false;
	const emit = (text, ending) =>
		write(`${text === "" ? "" : prefix}${text}${ending}`);
	const consume = (character) => {
		if (carriageReturn) {
			carriageReturn = false;
			if (character === "\n") {
				emit(line, "\n");
				line = "";
				return;
			}
			if (overwrite && line !== "") emit(line, "\r");
			line = "";
		}
		if (character === "\r") carriageReturn = true;
		else if (character === "\n") {
			emit(line, "\n");
			line = "";
		} else line += character;
	};
	return {
		push(chunk) {
			for (const character of decoder.write(chunk)) consume(character);
		},
		flush() {
			for (const character of decoder.end()) consume(character);
			if (line !== "") emit(line, "\n");
			line = "";
			carriageReturn = false;
		},
	};
}
