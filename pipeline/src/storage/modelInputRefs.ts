/**
 * What a `model_input.key` names. Most keys are a `series.key`. An input that
 * is not one series (a whole dataset read directly, or the weights a model
 * placed votes with) is written as a reference instead, so it resolves to its
 * sources with no guessing:
 *
 * - `dataset:<slug>` names a dataset (`dataset.slug`), and so its source.
 * - `weights:<basis>` names a weight basis (`weight_basis.id`), and so the
 *   inputs its crosswalk weights were counted from.
 *
 * Either may end in ` (<detail>)`, free text for a reader, such as the file
 * that was read.
 */
export type ModelInputRef =
	| { kind: "dataset"; slug: string; detail: string | null }
	| { kind: "weights"; basis: string; detail: string | null };

const REF = /^(dataset|weights):([a-z0-9][a-z0-9-]*)(?: \((.+)\))?$/;

export const datasetInput = (slug: string, detail?: string): string =>
	`dataset:${slug}${detail === undefined ? "" : ` (${detail})`}`;

export const weightsInput = (basis: string, detail?: string): string =>
	`weights:${basis}${detail === undefined ? "" : ` (${detail})`}`;

/** The reference a key is, or `null` when it is not written as one. */
export const parseModelInputRef = (key: string): ModelInputRef | null => {
	const match = REF.exec(key);
	if (!match) return null;
	const detail = match[3] ?? null;
	return match[1] === "dataset"
		? { kind: "dataset", slug: match[2]!, detail }
		: { kind: "weights", basis: match[2]!, detail };
};
