import type { CustomDataset, CustomPoint, PointStyle } from "../types/custom";
import { BOUNDARY_TYPES } from "./boundaries/catalog";

const BOUNDARY_TYPE_SET = new Set<string>(BOUNDARY_TYPES);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isNumberRecord = (value: unknown): value is Record<string, number> =>
	isRecord(value) &&
	Object.values(value).every((entry) => typeof entry === "number");

const isCustomPoint = (value: unknown): value is CustomPoint =>
	isRecord(value) &&
	typeof value.lng === "number" &&
	typeof value.lat === "number" &&
	typeof value.value === "number" &&
	(value.label === undefined || typeof value.label === "string") &&
	(value.details === undefined || isStringArray(value.details)) &&
	(value.areaCode === undefined || typeof value.areaCode === "string");

const isPointStyle = (value: unknown): value is PointStyle => {
	if (!isRecord(value)) return false;
	if (
		value.colorByValue !== undefined &&
		(!isRecord(value.colorByValue) ||
			!Object.values(value.colorByValue).every(
				(color) => typeof color === "string",
			))
	)
		return false;
	if (
		value.legend !== undefined &&
		(!Array.isArray(value.legend) ||
			!value.legend.every(
				(entry) =>
					isRecord(entry) &&
					typeof entry.value === "number" &&
					typeof entry.label === "string",
			))
	)
		return false;
	if (
		value.tooltip !== undefined &&
		(!isRecord(value.tooltip) ||
			typeof value.tooltip.title !== "string" ||
			!isStringArray(value.tooltip.fields))
	)
		return false;
	return (
		value.radius === undefined ||
		(isRecord(value.radius) &&
			typeof value.radius.min === "number" &&
			typeof value.radius.max === "number")
	);
};

const isCustomDataset = (value: unknown): value is CustomDataset =>
	isRecord(value) &&
	typeof value.id === "string" &&
	value.type === "custom" &&
	(value.kind === "choropleth" || value.kind === "points") &&
	typeof value.name === "string" &&
	typeof value.year === "number" &&
	typeof value.boundaryType === "string" &&
	BOUNDARY_TYPE_SET.has(value.boundaryType) &&
	typeof value.boundaryYear === "number" &&
	typeof value.dataColumn === "string" &&
	isNumberRecord(value.data) &&
	(value.points === undefined ||
		(Array.isArray(value.points) && value.points.every(isCustomPoint))) &&
	(value.pointSummaries === undefined ||
		(isRecord(value.pointSummaries) &&
			Object.values(value.pointSummaries).every(
				(summary) =>
					isRecord(summary) &&
					typeof summary.count === "number" &&
					typeof summary.averageValue === "number",
			))) &&
	(value.valueMin === undefined || typeof value.valueMin === "number") &&
	(value.valueMax === undefined || typeof value.valueMax === "number") &&
	(value.pointStyle === undefined || isPointStyle(value.pointStyle));

export const parseRoadSafetyDataset = (value: unknown): CustomDataset => {
	if (!isCustomDataset(value))
		throw new Error("Invalid road safety dataset entry.");
	return value;
};

export const parseRoadSafetyPoints = (value: unknown): CustomPoint[] => {
	if (!Array.isArray(value) || !value.every(isCustomPoint))
		throw new Error("Invalid road safety points entry.");
	return value;
};
