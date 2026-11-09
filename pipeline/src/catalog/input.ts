import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readAtlasPayload } from "@uk-data-atlas/catalogue/node";

export class AtlasDatasetInput {
	readonly repositoryRoot: string;
	readonly output: string;
	readonly source: "datasets" | "atlas";
	constructor(
		repositoryRoot: string,
		output: string,
		source: "datasets" | "atlas" = "datasets",
	) {
		this.repositoryRoot = repositoryRoot;
		this.output = output;
		this.source = source;
	}
	read() {
		if (this.source === "atlas")
			return readAtlasPayload(
				this.repositoryRoot,
				this.output === "dataset-manifest"
					? this.output
					: `dataset:${this.output}`,
			);
		return readFileSync(
			join(
				this.repositoryRoot,
				"data/build/datasets",
				`${this.output}.json`,
			),
			"utf8",
		);
	}
	toString() {
		return this.source === "atlas"
			? `data/build/atlas.sqlite:${this.output}`
			: `data/build/datasets/${this.output}.json`;
	}
}

export type DatasetInput = string | AtlasDatasetInput;
export const readDatasetInput = (input: DatasetInput): string =>
	typeof input === "string" ? readFileSync(input, "utf8") : input.read();
