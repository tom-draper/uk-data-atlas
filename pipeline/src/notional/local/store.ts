import { DatabaseSync } from "node:sqlite";
import { notionalPath } from "../store.ts";
import type { Residual } from "./backtest.ts";
import { summarise } from "./backtest.ts";
import type { WardNotional } from "./estimate.ts";
import type { LocalInputs } from "./inputs.ts";

/**
 * The local notionals in the notional component, beside the general election
 * ones, as two models: one from the share-alike results (2016 to 2019) and
 * one from the open ones, so each carries its inputs' licence.
 */

export const LOCAL_NOTIONAL_SCHEMA = `
CREATE TABLE local_notional_model (
	model TEXT PRIMARY KEY,
	label TEXT NOT NULL,
	licence_id TEXT,
	bound_factor REAL NOT NULL
);
CREATE TABLE local_notional_input (
	model TEXT NOT NULL,
	role TEXT NOT NULL,
	key TEXT NOT NULL,
	PRIMARY KEY (model, role, key)
);
CREATE TABLE local_notional_estimate (
	model TEXT NOT NULL,
	-- The new ward, on the ward release it is first seen on.
	ward TEXT NOT NULL,
	name TEXT,
	release TEXT NOT NULL,
	-- The ward release of the old wards, and the election they were polled at.
	from_release TEXT NOT NULL,
	period TEXT NOT NULL,
	party TEXT NOT NULL,
	value REAL NOT NULL,
	lower REAL NOT NULL,
	upper REAL NOT NULL,
	-- derived: the ward is one or more whole old wards, so its votes are exact.
	-- estimated: some votes came from old wards split between new wards.
	status TEXT NOT NULL CHECK (status IN ('derived', 'estimated')),
	at_risk REAL NOT NULL,
	coverage REAL NOT NULL,
	origins TEXT NOT NULL,
	PRIMARY KEY (model, release, ward, party)
);
CREATE TABLE local_notional_score (
	scope TEXT PRIMARY KEY,
	n INTEGER NOT NULL,
	rmse REAL NOT NULL
);
`;

export const LOCAL_MODELS = {
	sharealike: {
		model: "notional-local-sharealike",
		label: "Notional local election results on new wards, from CC BY-SA results",
	},
	open: {
		model: "notional-local-open",
		label: "Notional local election results on new wards",
	},
} as const;

export const isDerived = (notional: WardNotional) =>
	Object.values(notional.atRisk).every((risk) => risk === 0);

/**
 * Adds the local notionals to the component `writeNotional` made, with their
 * backtest. Bounds are `factor` times each party's at-risk votes.
 */
export const writeLocalNotional = (
	root: string,
	inputs: LocalInputs,
	notionals: readonly WardNotional[],
	residuals: readonly Residual[],
	factor: number,
) => {
	const database = new DatabaseSync(notionalPath(root));
	try {
		database.exec(LOCAL_NOTIONAL_SCHEMA);
		database.exec("BEGIN");
		const model = database.prepare(
			"INSERT INTO local_notional_model VALUES (?, ?, ?, ?)",
		);
		const input = database.prepare(
			"INSERT OR IGNORE INTO local_notional_input VALUES (?, ?, ?)",
		);
		const estimate = database.prepare(
			`INSERT INTO local_notional_estimate (model, ward, name, release, from_release, period, party, value, lower, upper, status, at_risk, coverage, origins)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		);
		for (const shareAlike of [true, false]) {
			const ships = shareAlike
				? LOCAL_MODELS.sharealike
				: LOCAL_MODELS.open;
			const own = notionals.filter((n) => !!n.shareAlike === shareAlike);
			if (own.length === 0) continue;
			const licences = [
				...new Set(own.flatMap((n) => n.shareAlike ?? [])),
			];
			if (licences.length > 1)
				throw new Error(
					`Local notionals under more than one share-alike licence: ${licences.join(", ")}`,
				);
			model.run(ships.model, ships.label, licences[0] ?? null, factor);
			const periods = new Set(own.map((n) => n.period));
			for (const election of inputs.elections)
				if (periods.has(election.period))
					for (const key of election.keys)
						input.run(
							ships.model,
							`local election ${election.period}`,
							key,
						);
			for (const key of inputs.censusKeys)
				input.run(ships.model, "census 2021", key);
			input.run(ships.model, "weights", "weight-atoms population");
			for (const n of own) {
				const status = isDerived(n) ? "derived" : "estimated";
				for (const [party, value] of Object.entries(n.votes)) {
					const risk = n.atRisk[party] ?? 0;
					estimate.run(
						ships.model,
						n.code,
						inputs.names.get(n.release)?.get(n.code) ?? null,
						n.release,
						n.from,
						n.period,
						party,
						value,
						Math.max(0, value - factor * risk),
						value + factor * risk,
						status,
						risk,
						n.coverage,
						n.origins.join(","),
					);
				}
			}
		}
		const score = database.prepare(
			"INSERT INTO local_notional_score VALUES (?, ?, ?)",
		);
		for (const { group, n, rmse } of summarise(residuals))
			score.run(group, n, rmse);
		database.exec("COMMIT");
	} finally {
		database.close();
	}
};
