import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDirectory = join(repositoryRoot, "data", "transport", "os-open-roads");
const mbtilesFile = join(dataDirectory, "oproad_gb.mbtiles");

if (!existsSync(mbtilesFile)) {
	console.error(
		"OS Open Roads MBTiles not found at data/transport/os-open-roads/oproad_gb.mbtiles. Download and extract the OS Open Roads Vector Tiles archive first.",
	);
	process.exit(1);
}

const server = spawn(
	"docker",
	[
		"run",
		"--rm",
		"--name",
		"uk-data-atlas-os-roads",
		"-p",
		"8080:8080",
		"-v",
		`${dataDirectory}:/data`,
		"maptiler/tileserver-gl:latest",
		"--file",
		"oproad_gb.mbtiles",
	],
	{ stdio: "inherit" },
);

server.on("error", (error) => {
	console.error(`Could not start the OS Open Roads tile server: ${error.message}`);
	process.exit(1);
});

server.on("exit", (code) => process.exit(code ?? 1));
