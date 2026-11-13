/** The filters `/v1/datasets` and `/v1/measures` share. */
export const taxonomyParameters = [
	{
		name: "theme",
		in: "query",
		required: false,
		schema: { type: "string" },
		description:
			"List only what is filed under this theme, such as `population`. The themes are listed by `GET /v1/themes`. An id that is not a theme is refused, with the ids that are.",
	},
	{
		name: "topic",
		in: "query",
		required: false,
		schema: { type: "string" },
		description:
			"List only what is filed under this topic, such as `population-estimates`. The topics are listed under their themes by `GET /v1/themes`. An id that is not a topic is refused, with the ids that are.",
	},
	{
		name: "module",
		in: "query",
		required: false,
		schema: { type: "string" },
		description:
			"List only what is downloaded in this module, such as `population`. The modules are listed by `GET /v1/modules`. An id that is not a module is refused, with the ids that are.",
	},
] as const;
