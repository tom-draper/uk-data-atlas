import type { ValidationCheckId } from "@uk-data-atlas/atlas-runtime/catalogue";
export { sha256 } from "@uk-data-atlas/artifacts";

export type Finding = {
	id: ValidationCheckId;
	passed: boolean;
	detail?: string;
	measured?: Record<string, number | string | null>;
};

export const listed = (values: string[], limit = 10) =>
	values.length > limit
		? `${values.slice(0, limit).join(", ")} and ${values.length - limit} more`
		: values.join(", ");

export const check = (
	id: ValidationCheckId,
	passed: boolean,
	detail?: string,
	measured?: Finding["measured"],
): Finding => ({
	id,
	passed,
	...(passed || detail === undefined ? {} : { detail }),
	...(measured ? { measured } : {}),
});
