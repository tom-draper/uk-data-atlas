import {
	ATLAS_BOUNDARY_VINTAGES,
	type AtlasBoundaryVintages,
} from "@uk-data-atlas/catalogue";
import type { FuelPovertyDataset } from "@uk-data-atlas/datasets/types/fuelPoverty";
import type { SQLInputValue } from "node:sqlite";
import { rebuildFuelPoverty } from "./catalogueObservations";
import type { SqliteTable } from "@uk-data-atlas/artifacts";

const measures = [
	["householdCount", "Households", "households"],
	["fuelPoorHouseholdCount", "Fuel poor households", "households"],
	["fuelPovertyRate", "Fuel poverty rate", "percent"],
] as const;

export function catalogueObservationTables(
	text?: string,
): Record<string, SqliteTable> {
	const periods: Record<string, FuelPovertyDataset> =
		text === undefined ? {} : JSON.parse(text);
	const records = Object.fromEntries(
		Object.entries(periods).map(([period, dataset]) => [
			period,
			Object.values(dataset.data),
		]),
	);
	return {
		catalogue_measures: {
			columns: [
				"dataset TEXT NOT NULL REFERENCES datasets(type)",
				"id TEXT NOT NULL",
				"field TEXT NOT NULL",
				"label TEXT NOT NULL",
				"unit TEXT NOT NULL",
				"position INTEGER NOT NULL",
			],
			key: ["dataset", "id"],
			rows:
				text === undefined
					? []
					: measures.map(([field, label, unit], position) => [
							"fuelPoverty",
							field,
							field,
							label,
							unit,
							position,
						]),
		},
		catalogue_periods: {
			columns: [
				"dataset TEXT NOT NULL REFERENCES datasets(type)",
				"period TEXT NOT NULL",
				"position INTEGER NOT NULL",
				"header TEXT NOT NULL",
			],
			key: ["dataset", "period"],
			rows: Object.entries(periods).map(
				([period, { data, ...header }], position) => [
					"fuelPoverty",
					period,
					position,
					JSON.stringify(header),
				],
			),
		},
		catalogue_records: {
			columns: [
				"dataset TEXT NOT NULL",
				"period TEXT NOT NULL",
				"areaId INTEGER NOT NULL REFERENCES areas(id)",
				"position INTEGER NOT NULL",
				"label TEXT NOT NULL",
			],
			key: ["dataset", "period", "areaId"],
			constraints: [
				"FOREIGN KEY (dataset, period) REFERENCES catalogue_periods(dataset, period)",
				"UNIQUE (dataset, period, position)",
			],
			rows: function* (database) {
				const lookup = database.prepare(
					"SELECT a.id FROM areas a JOIN area_releases r ON r.position = a.releasePosition WHERE r.geography = ? AND r.id = ? AND a.code = ?",
				);
				for (const [period, dataset] of Object.entries(periods)) {
					const release = (
						ATLAS_BOUNDARY_VINTAGES as AtlasBoundaryVintages
					).lsoa[dataset.boundaryYear];
					for (const [position, [code, record]] of Object.entries(
						dataset.data,
					).entries()) {
						if (!release)
							throw new Error(
								`Unknown fuel poverty boundary year ${dataset.boundaryYear}`,
							);
						const area = lookup.get(
							dataset.boundaryType,
							release,
							code,
						);
						if (!area || record.lsoaCode !== code)
							throw new Error(
								`Unknown fuel poverty area ${code}`,
							);
						yield [
							"fuelPoverty",
							period,
							area.id,
							position,
							record.lsoaName,
						];
					}
				}
			},
		},
		catalogue_observations: {
			columns: [
				"dataset TEXT NOT NULL",
				"measure TEXT NOT NULL",
				"areaId INTEGER NOT NULL REFERENCES areas(id)",
				"period TEXT NOT NULL",
				"value REAL NOT NULL",
			],
			key: ["dataset", "measure", "areaId", "period"],
			constraints: [
				"FOREIGN KEY (dataset, measure) REFERENCES catalogue_measures(dataset, id)",
				"FOREIGN KEY (dataset, period, areaId) REFERENCES catalogue_records(dataset, period, areaId)",
			],
			indexes: [["areaId", "dataset", "period"]],
			rows: function* (database): Generator<SQLInputValue[]> {
				for (const row of database
					.prepare(
						"SELECT period, areaId, position FROM catalogue_records WHERE dataset = 'fuelPoverty' ORDER BY period, position",
					)
					.all()) {
					const record =
						records[String(row.period)][Number(row.position)];
					for (const [field] of measures) {
						const value = record[field];
						if (!Number.isFinite(value))
							throw new Error(
								`Invalid fuel poverty value ${field}`,
							);
						yield [
							"fuelPoverty",
							field,
							row.areaId,
							row.period,
							value,
						];
					}
				}
				if (text !== undefined && rebuildFuelPoverty(database) !== text)
					throw new Error(
						"Fuel poverty rows differ from catalogue payload",
					);
			},
		},
	};
}
