import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const ROOT = join(here, "..", "..");
export const SPEC = join(ROOT, "services", "api", "openapi.yaml");
export const CLIENTS = join(ROOT, "clients");
export const TYPESCRIPT_GENERATED = join(
	CLIENTS,
	"typescript",
	"src",
	"generated",
);
export const PYTHON_GENERATED = join(
	CLIENTS,
	"python",
	"src",
	"uk_data_atlas_client",
	"generated",
);
