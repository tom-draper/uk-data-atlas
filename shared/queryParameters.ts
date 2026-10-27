import type { ChoiceRule, WholeNumberRule } from "./queryRuleCompiler";

/** A finite decimal query value, or undefined when absent or invalid. */
export const readFiniteNumber = (value: string | null) => {
	if (value === null || value.trim() === "") return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * A whole-number query value within an inclusive range. A missing value uses
 * the supplied fallback; malformed values remain distinguishable as invalid.
 */
export const readBoundedWholeNumber = (
	value: string | null,
	fallback: number,
	minimum: number,
	maximum: number,
) => {
	if (value === null) return fallback;
	const parsed = Number(value);
	return /^\d+$/.test(value) &&
		Number.isInteger(parsed) &&
		parsed >= minimum &&
		parsed <= maximum
		? parsed
		: undefined;
};

/**
 * A parameter read through its rule in `queryRules.ts`: its value, the rule's
 * default when it is absent, undefined when it is absent and has no default,
 * and null when it is supplied but the rule refuses it.
 */
type Read<Rule, Value> =
	Value | null | (Rule extends { default: unknown } ? never : undefined);

/** One of the values the parameter's enum allows. */
export const readChoice = <const Rule extends ChoiceRule>(
	value: string | null,
	rule: Rule,
): Read<Rule, Rule["values"][number]> => {
	if (value === null) return rule.default as never;
	return (rule.values.includes(value) ? value : null) as never;
};

/** A whole number, in plain digits, within the parameter's stated range. */
export const readWholeNumber = <const Rule extends WholeNumberRule>(
	value: string | null,
	rule: Rule,
): Read<Rule, number> => {
	if (value === null) return rule.default as never;
	return (readBoundedWholeNumber(value, 0, rule.minimum, rule.maximum) ??
		null) as never;
};

/** A rule's values as a refusal lists them: `json, csv or ndjson`. */
export const choices = ({ values }: ChoiceRule) =>
	values.length < 2
		? values.join("")
		: `${values.slice(0, -1).join(", ")} or ${values.at(-1)}`;
