import { readFileSync } from "node:fs";
import { readAtlasPayload } from "@uk-data-atlas/catalogue/node";
import { readBaseDatasetInput } from "./baseDatasetInput.ts";

export class AtlasDatasetInput {
	readonly repositoryRoot: string;
	readonly output: string;
	readonly source: "atlas" | "rows";
	constructor(
		repositoryRoot: string,
		output: string,
		source: "atlas" | "rows",
	) {
		this.repositoryRoot = repositoryRoot;
		this.output = output;
		this.source = source;
	}
	read() {
		if (this.source === "rows")
			return readBaseDatasetInput(this.repositoryRoot, this.output);
		return readAtlasPayload(
			this.repositoryRoot,
			this.output === "dataset-manifest"
				? this.output
				: `dataset:${this.output}`,
		);
	}
	toString() {
		if (this.source === "rows")
			return `data/build/atlas-base.sqlite:${this.output}`;
		return `data/build/atlas.sqlite:${this.output}`;
	}
}

export type DatasetInput = string | AtlasDatasetInput;
export const readDatasetInput = (input: DatasetInput): string =>
	typeof input === "string" ? readFileSync(input, "utf8") : input.read();
