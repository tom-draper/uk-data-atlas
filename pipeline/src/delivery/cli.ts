import { readFileSync } from "node:fs";
import { createDelivery, type DeliveryLicence } from "./createDelivery.ts";

const [source, destination, details] = process.argv.slice(2);
if (!source || !destination || !details || process.argv.length !== 5)
	throw new Error(
		"Usage: pnpm delivery:create <atlas.sqlite> <new-delivery.sqlite> <licence-details.json>",
	);
createDelivery(
	source,
	destination,
	JSON.parse(readFileSync(details, "utf8")) as DeliveryLicence,
);
