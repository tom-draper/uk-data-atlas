import { describe, expect, it } from "vitest";
import {
	DATASET_FOUNDATION_PARTS,
	DATASET_THEMES,
	DATASET_TOPICS,
	getDatasetTheme,
	isDatasetFoundationPart,
	isDatasetTheme,
	isDatasetTopic,
	themeOfTopic,
	topicsOfTheme,
} from "@uk-data-atlas/datasets";

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
// "general" is only a catch-all on its own: `general-elections` is a real topic.
const CATCH_ALL =
	/^(misc|miscellaneous|other|others|general)$|(^|-)(misc|miscellaneous|other|others)(-|$)/;

describe("theme and topic registry", () => {
	it("has the ten ratified themes in order", () => {
		expect(DATASET_THEMES.map(({ id }) => id)).toEqual([
			"population",
			"economy",
			"housing",
			"health",
			"education",
			"society",
			"politics",
			"environment",
			"transport",
			"infrastructure",
		]);
	});

	it("keeps foundation parts apart from themes", () => {
		expect(DATASET_FOUNDATION_PARTS.map(({ id }) => id)).toEqual([
			"core",
			"boundaries",
			"postcodes",
		]);
		expect(
			DATASET_FOUNDATION_PARTS.filter(
				({ alwaysIncluded }) => alwaysIncluded,
			),
		).toHaveLength(1);
		for (const { id } of DATASET_FOUNDATION_PARTS) {
			expect(isDatasetTheme(id)).toBe(false);
			expect(isDatasetFoundationPart(id)).toBe(true);
		}
	});

	it("uses unique kebab-case ids across themes, foundation parts and topics", () => {
		const ids = [
			...DATASET_THEMES,
			...DATASET_FOUNDATION_PARTS,
			...DATASET_TOPICS,
		].map(({ id }) => id);
		for (const id of ids) expect(id).toMatch(KEBAB_CASE);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("gives every theme, part and topic a label and a description", () => {
		for (const entry of [
			...DATASET_THEMES,
			...DATASET_FOUNDATION_PARTS,
			...DATASET_TOPICS,
		]) {
			expect(entry.label.trim(), entry.id).not.toBe("");
			expect(entry.description.trim(), entry.id).not.toBe("");
			expect(entry.label + entry.description, entry.id).not.toMatch(
				/[—–]/,
			);
		}
	});

	it("puts every topic in a real theme and every theme has topics", () => {
		for (const topic of DATASET_TOPICS) {
			expect(isDatasetTheme(topic.theme), topic.id).toBe(true);
			expect(themeOfTopic(topic.id)).toBe(topic.theme);
		}
		for (const { id } of DATASET_THEMES)
			expect(topicsOfTheme(id).length, id).toBeGreaterThan(0);
	});

	it("has no catch-all topics", () => {
		for (const { id, label } of DATASET_TOPICS) {
			expect(id, id).not.toMatch(CATCH_ALL);
			expect(label.toLowerCase(), id).not.toMatch(CATCH_ALL);
		}
	});

	it("numbers the display order completely, from 1, with no gaps", () => {
		expect(DATASET_THEMES.map(({ order }) => order)).toEqual(
			DATASET_THEMES.map((_, index) => index + 1),
		);
		expect(DATASET_FOUNDATION_PARTS.map(({ order }) => order)).toEqual(
			DATASET_FOUNDATION_PARTS.map((_, index) => index + 1),
		);
		for (const { id } of DATASET_THEMES) {
			const topics = topicsOfTheme(id);
			expect(
				topics.map(({ order }) => order),
				id,
			).toEqual(topics.map((_, index) => index + 1));
		}
	});

	it("lists topics by theme order, then topic order", () => {
		const position = (theme: string) =>
			getDatasetTheme(theme as never).order;
		const keys = DATASET_TOPICS.map(
			(topic) => position(topic.theme) * 1000 + topic.order,
		);
		expect(keys).toEqual([...keys].sort((a, b) => a - b));
	});

	it("recognises only registered ids", () => {
		expect(isDatasetTopic("labour-market")).toBe(true);
		expect(isDatasetTopic("economy")).toBe(false);
		expect(isDatasetTopic(undefined)).toBe(false);
		expect(isDatasetTheme("crime")).toBe(false);
		expect(isDatasetTheme("society")).toBe(true);
	});
});
