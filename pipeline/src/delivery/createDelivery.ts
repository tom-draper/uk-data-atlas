import { constants, copyFileSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export type DeliveryLicence = {
	customer: string;
	order: string;
	release: string;
	terms: string;
};

/** Create a new customer-specific copy; never modify the source or replace a delivery. */
export function createDelivery(
	source: string,
	destination: string,
	licence: DeliveryLicence,
) {
	for (const field of ["customer", "order", "release", "terms"] as const)
		if (typeof licence[field] !== "string" || !licence[field].trim())
			throw new Error(`Delivery ${field} must be a non-empty string`);
	copyFileSync(source, destination, constants.COPYFILE_EXCL);
	try {
		const db = new DatabaseSync(destination);
		try {
			db.exec(`BEGIN;
    CREATE TABLE delivery_licence (customer TEXT NOT NULL, order_reference TEXT NOT NULL, release TEXT NOT NULL, terms TEXT NOT NULL) STRICT`);
			db.prepare("INSERT INTO delivery_licence VALUES (?, ?, ?, ?)").run(
				licence.customer,
				licence.order,
				licence.release,
				licence.terms,
			);
			db.exec("COMMIT");
		} finally {
			db.close();
		}
	} catch (error) {
		rmSync(destination, { force: true });
		throw error;
	}
}
