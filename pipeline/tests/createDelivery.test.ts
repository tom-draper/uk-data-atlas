import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { createDelivery } from "../src/delivery/createDelivery.ts";

test("creates an independent delivery with the supplied contractual details", () => {
	const dir = mkdtempSync(join(tmpdir(), "atlas-delivery-"));
	try {
		const source = join(dir, "source.sqlite");
		const output = join(dir, "customer.sqlite");
		const db = new DatabaseSync(source);
		db.exec(
			"CREATE TABLE licence (id TEXT PRIMARY KEY); INSERT INTO licence VALUES ('ogl-3.0')",
		);
		db.close();
		const details = {
			customer: "Example Ltd",
			order: "ORDER-1",
			release: "2026-11",
			terms: "Agreed terms, subject to source licences.",
		};
		createDelivery(source, output, details);
		const delivered = new DatabaseSync(output, { readOnly: true });
		expect(
			delivered.prepare("SELECT * FROM delivery_licence").get(),
		).toMatchObject({
			customer: details.customer,
			order_reference: details.order,
			release: details.release,
			terms: details.terms,
		});
		expect(
			delivered.prepare("SELECT count(*) AS n FROM licence").get(),
		).toMatchObject({ n: 1 });
		delivered.close();
		const original = new DatabaseSync(source, { readOnly: true });
		expect(
			original
				.prepare(
					"SELECT name FROM sqlite_schema WHERE name='delivery_licence'",
				)
				.get(),
		).toBeUndefined();
		original.close();
		expect(() => createDelivery(source, output, details)).toThrow();
		const sentinel = join(dir, "sentinel");
		writeFileSync(sentinel, "keep");
		expect(() => createDelivery(source, sentinel, details)).toThrow();
		expect(readFileSync(sentinel, "utf8")).toBe("keep");
		expect(() =>
			createDelivery(source, join(dir, "invalid"), {
				...details,
				order: " ",
			}),
		).toThrow();
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
