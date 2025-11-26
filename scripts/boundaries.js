#!/usr/bin/env node

/**
 * Script to process large GeoJSON files into optimized TopoJSON
 *
 * Usage:
 *   node process-boundaries.js input.geojson output.topojson
 *
 * Requirements:
 *   npm install -g topojson-server topojson-client topojson-simplify
 *   npm install mapshaper -g (optional, for more advanced simplification)
 */

const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

// Configuration
const CONFIG = {
	// Quantization (1000-10000 recommended, higher = more precision)
	quantization: 5000,

	// Simplification (0.00001-0.001, lower = more aggressive)
	simplification: 0.00001,

	// Coordinate precision (5-6 decimal places for ~1m precision)
	precision: 6,

	// Properties to keep (add your essential properties here)
	keepProperties: [
		// Ward properties
		"WD24CD",
		"WD24NM",
		"WD23CD",
		"WD23NM",
		"WD22CD",
		"WD22NM",
		"WD21CD",
		"WD21NM",
		// LAD properties
		"LAD25CD",
		"LAD25NM",
		"LAD24CD",
		"LAD24NM",
		"LAD23CD",
		"LAD23NM",
		"LAD22CD",
		"LAD22NM",
		"LAD21CD",
		"LAD21NM",
		// Constituency properties
		"PCON24CD",
		"PCON24NM",
		"pcon19cd",
		"pcon19nm",
		"PCON17CD",
		"PCON17NM",
		"PCON15CD",
		"PCON15NM",
	],
};

/**
 * Remove unnecessary properties from GeoJSON
 */
function cleanProperties(geojson, keepProps) {
	const cleaned = { ...geojson };
	cleaned.features = geojson.features.map((feature) => {
		const cleanedProps = {};
		keepProps.forEach((prop) => {
			if (feature.properties[prop] !== undefined) {
				cleanedProps[prop] = feature.properties[prop];
			}
		});
		return {
			...feature,
			properties: cleanedProps,
		};
	});
	return cleaned;
}

/**
 * Reduce coordinate precision
 */
function reduceCoordinatePrecision(geojson, precision) {
	const factor = Math.pow(10, precision);

	function roundCoords(coords) {
		if (typeof coords[0] === "number") {
			return coords.map((c) => Math.round(c * factor) / factor);
		}
		return coords.map(roundCoords);
	}

	const processed = { ...geojson };
	processed.features = geojson.features.map((feature) => ({
		...feature,
		geometry: {
			...feature.geometry,
			coordinates: roundCoords(feature.geometry.coordinates),
		},
	}));

	return processed;
}

/**
 * Process a single GeoJSON file
 */
async function processFile(inputPath, outputPath) {
	console.log(`\n📁 Processing: ${inputPath}`);

	const inputSize = fs.statSync(inputPath).size;
	console.log(`   Original size: ${(inputSize / 1024 / 1024).toFixed(2)} MB`);

	// Read and parse GeoJSON
	console.log("   Step 1/4: Reading file...");
	const geojson = JSON.parse(fs.readFileSync(inputPath, "utf8"));

	// Clean properties
	console.log("   Step 2/4: Cleaning properties...");
	const cleaned = cleanProperties(geojson, CONFIG.keepProperties);

	// Reduce precision
	console.log("   Step 3/4: Reducing coordinate precision...");
	const reduced = reduceCoordinatePrecision(cleaned, CONFIG.precision);

	// Write temporary cleaned file
	const tempPath = inputPath.replace(".geojson", ".temp.geojson");
	fs.writeFileSync(tempPath, JSON.stringify(reduced));

	// Convert to TopoJSON using command line tools
	console.log("   Step 4/4: Converting to TopoJSON...");
	try {
		const objectName = path.basename(inputPath, ".geojson");

		execSync(
			`geo2topo ${objectName}=${tempPath} | ` +
				`toposimplify -p ${CONFIG.simplification} -f | ` +
				`topoquantize ${CONFIG.quantization} > ${outputPath}`,
			{ stdio: "inherit" },
		);

		// Clean up temp file
		fs.unlinkSync(tempPath);

		const outputSize = fs.statSync(outputPath).size;
		const reduction = ((1 - outputSize / inputSize) * 100).toFixed(1);

		console.log(
			`   ✅ Output size: ${(outputSize / 1024 / 1024).toFixed(2)} MB`,
		);
		console.log(`   📉 Reduction: ${reduction}%`);
	} catch (error) {
		console.error("   ❌ Error during conversion:", error.message);
		if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
		throw error;
	}
}

/**
 * Process directory of files
 */
async function processDirectory(inputDir, outputDir) {
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	const files = fs.readdirSync(inputDir).filter((f) =>
		f.endsWith(".geojson")
	);

	console.log(`Found ${files.length} GeoJSON files to process\n`);

	for (const file of files) {
		const inputPath = path.join(inputDir, file);
		const outputPath = path.join(
			outputDir,
			file.replace(".geojson", ".json"),
		);

		try {
			await processFile(inputPath, outputPath);
		} catch (error) {
			console.error(`Failed to process ${file}:`, error.message);
		}
	}
}

/**
 * Recursively find all .geojson files in a directory
 */
function findAllGeoJsonFiles(dir, fileList = []) {
	const files = fs.readdirSync(dir);

	files.forEach((file) => {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);

		if (stat.isDirectory()) {
			findAllGeoJsonFiles(filePath, fileList);
		} else if (file.endsWith(".geojson")) {
			fileList.push(filePath);
		}
	});

	return fileList;
}

/**
 * Process all boundaries in /public/data folder structure
 */
async function processAllBoundaries(baseDir = "./public/data") {
	console.log(`\n🗺️  Processing all boundaries in: ${baseDir}\n`);

	if (!fs.existsSync(baseDir)) {
		console.error(`❌ Directory not found: ${baseDir}`);
		process.exit(1);
	}

	const allFiles = findAllGeoJsonFiles(baseDir);

	if (allFiles.length === 0) {
		console.log("No .geojson files found!");
		process.exit(0);
	}

	console.log(`Found ${allFiles.length} GeoJSON files:\n`);
	allFiles.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
	console.log("");

	let processed = 0;
	let failed = 0;
	const results = [];

	for (const inputPath of allFiles) {
		const outputPath = inputPath.replace(".geojson", ".topojson");

		try {
			const inputSize = fs.statSync(inputPath).size;
			await processFile(inputPath, outputPath);
			const outputSize = fs.statSync(outputPath).size;
			const reduction = ((1 - outputSize / inputSize) * 100).toFixed(1);

			processed++;
			results.push({
				file: path.relative(baseDir, inputPath),
				inputSize,
				outputSize,
				reduction,
			});
		} catch (error) {
			console.error(`❌ Failed: ${inputPath}`);
			failed++;
		}
	}

	// Print summary
	console.log("\n" + "=".repeat(80));
	console.log("📊 PROCESSING SUMMARY");
	console.log("=".repeat(80));
	console.log(`✅ Successfully processed: ${processed} files`);
	if (failed > 0) console.log(`❌ Failed: ${failed} files`);

	const totalInput = results.reduce((sum, r) => sum + r.inputSize, 0);
	const totalOutput = results.reduce((sum, r) => sum + r.outputSize, 0);
	const avgReduction = ((1 - totalOutput / totalInput) * 100).toFixed(1);

	console.log(
		`\n📦 Total input size:  ${(totalInput / 1024 / 1024).toFixed(2)} MB`,
	);
	console.log(
		`📦 Total output size: ${(totalOutput / 1024 / 1024).toFixed(2)} MB`,
	);
	console.log(`📉 Average reduction: ${avgReduction}%`);

	console.log("\n📋 Detailed Results:");
	console.log("-".repeat(80));
	results.forEach((r) => {
		console.log(
			`${r.file.padEnd(50)} ` +
				`${(r.inputSize / 1024 / 1024).toFixed(2).padStart(8)} MB → ` +
				`${(r.outputSize / 1024 / 1024).toFixed(2).padStart(8)} MB ` +
				`(${r.reduction}% reduction)`,
		);
	});
	console.log("=".repeat(80) + "\n");
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
	console.log(`
🗺️  Boundary File Processor

Usage:
  All boundaries:  node process-boundaries.js --all [base-dir]
                   node process-boundaries.js --all ./public/data
  
  Single file:     node process-boundaries.js input.geojson [output.topojson]
  
  Directory:       node process-boundaries.js input-dir/ output-dir/

Configuration (edit in script):
  - Quantization: ${CONFIG.quantization}
  - Simplification: ${CONFIG.simplification}
  - Precision: ${CONFIG.precision} decimal places
  - Keeping ${CONFIG.keepProperties.length} properties

Requirements:
  npm install -g topojson-server topojson-client topojson-simplify
  `);
	process.exit(0);
}

// Check for --all flag
if (args[0] === "--all" || args[0] === "-a") {
	const baseDir = args[1] || "./public/data/boundaries";
	processAllBoundaries(baseDir);
} else {
	const input = args[0];
	const output = args[1] || args[0].replace(".geojson", ".topojson");

	if (fs.statSync(input).isDirectory()) {
		processDirectory(input, output);
	} else {
		processFile(input, output);
	}
}
