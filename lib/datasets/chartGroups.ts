export interface ChartGroupDefinition {
	group: string;
	title: string;
}

/** Display order and labels for registry-driven chart sections. */
export const CHART_GROUPS: readonly ChartGroupDefinition[] = [
	{ group: "General Election", title: "General Election Results" },
	{ group: "Local Election", title: "Local Election Results" },
	{ group: "Brexit", title: "Brexit" },
	{ group: "Demographics", title: "Demographics" },
	{ group: "Economics", title: "Economics" },
	{ group: "Deprivation", title: "Deprivation" },
	{ group: "Health", title: "Health" },
	{ group: "Education", title: "Education" },
	{ group: "Telecoms", title: "Telecoms" },
	{ group: "Environment", title: "Environment" },
];
