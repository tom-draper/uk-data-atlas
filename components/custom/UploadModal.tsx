import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Upload, AlertCircle } from "lucide-react";
import {
	matchColumnAgainstBank,
	detectCoordinateColumns,
	AreaBank,
} from "@lib/data/areaBank";
import { detectHeaderRow, parseCustomCsv } from "@/lib/data/custom/csv";
import type { CustomDatasetUpload } from "@/lib/data/custom/dataset";
import { getMatchColorClass } from "./uploadStyles";
import { useIsDark } from "@/lib/context/ThemeContext";
import { ColumnDropdown } from "./ColumnDropdown";
import { RowBadge } from "./RowBadge";

export function UploadModal({
	isOpen,
	onClose,
	onUpload,
	areaBank,
}: {
	isOpen: boolean;
	onClose: () => void;
	onUpload: (data: CustomDatasetUpload) => void;
	areaBank: AreaBank;
}) {
	const [file, setFile] = useState<File | null>(null);
	const [csvData, setCsvData] = useState<string[][]>([]);
	const [headerRow, setHeaderRow] = useState(0);
	const [selectedColumn, setSelectedColumn] = useState("");
	const [dataColumn, setDataColumn] = useState("");
	const [latColumn, setLatColumn] = useState("");
	const [lngColumn, setLngColumn] = useState("");
	const [overrideLabel, setOverrideLabel] = useState("");
	const [showBoundaryOptions, setShowBoundaryOptions] = useState(false);
	const [error, setError] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const isDark = useIsDark();

	const headers = csvData[headerRow] ?? [];
	const firstDataRow = csvData[headerRow + 1] ?? [];
	const columns = headers.map((name, index) => ({
		name,
		preview: (firstDataRow[index] ?? "").slice(0, 25),
		index,
	}));

	const matches = (() => {
		if (!csvData.length || !selectedColumn) return [];
		const columnIndex = headers.indexOf(selectedColumn);
		if (columnIndex === -1) return [];
		const columnData = csvData
			.slice(headerRow + 1)
			.flatMap((row) => {
				const val = row[columnIndex];
				return val?.trim() ? [val] : [];
			});
		return matchColumnAgainstBank(columnData, areaBank);
	})();

	const effectiveMatch =
		(overrideLabel && matches.find(m => m.entry.label === overrideLabel)) ||
		matches[0] ||
		null;

	const canVisualise =
		effectiveMatch !== null &&
		effectiveMatch.entry.matchType !== "postcode-full" &&
		effectiveMatch.entry.matchType !== "postcode-district" &&
		effectiveMatch.entry.matchType !== "coordinate";

	// Route CSVs that carry lat/lng (and don't strongly match a boundary set) to
	// the point-plotting flow.
	const coord = useMemo(
		() => detectCoordinateColumns(csvData, headerRow),
		[csvData, headerRow],
	);
	const bestBoundaryPct =
		matches.find(
			(m) => m.entry.matchType === "code" || m.entry.matchType === "name",
		)?.percentage ?? 0;
	const isPointMode = coord !== null && bestBoundaryPct < 60;

	// Prefill the lat/lng/value pickers from detection when entering point mode.
	useEffect(() => {
		if (!coord || csvData.length === 0) return;
		const hdrs = csvData[headerRow] ?? [];
		const firstRow = csvData[headerRow + 1] ?? [];
		setLatColumn(hdrs[coord.latIdx] ?? "");
		setLngColumn(hdrs[coord.lngIdx] ?? "");
		const valIdx = hdrs.findIndex(
			(_, i) =>
				i !== coord.latIdx &&
				i !== coord.lngIdx &&
				firstRow[i]?.trim() &&
				!isNaN(Number(firstRow[i])),
		);
		if (valIdx >= 0) setDataColumn(hdrs[valIdx]);
	}, [coord, csvData, headerRow]);

	const resetForm = () => {
		setFile(null);
		setCsvData([]);
		setHeaderRow(0);
		setSelectedColumn("");
		setDataColumn("");
		setLatColumn("");
		setLngColumn("");
		setOverrideLabel("");
		setShowBoundaryOptions(false);
		setError("");
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0];
		if (!selectedFile) return;

		if (!selectedFile.name.endsWith(".csv")) {
			setError("Please select a CSV file");
			return;
		}

		setFile(selectedFile);
		setError("");

		const reader = new FileReader();
		reader.onload = (event) => {
			const text = event.target?.result as string;
			const rows = parseCustomCsv(text);
			setCsvData(rows);

			const detectedHeader = detectHeaderRow(rows);
			setHeaderRow(detectedHeader);

			const headerCells = rows[detectedHeader] ?? [];
			const codeColumn = headerCells.find((h) =>
				/code|area|ward|constituency|authority/i.test(h),
			);
			if (codeColumn) setSelectedColumn(codeColumn);
		};
		reader.readAsText(selectedFile);
	};

	const handleHeaderRowChange = (row: number) => {
		setHeaderRow(row);
		setSelectedColumn("");
		setDataColumn("");
		setOverrideLabel("");
		setShowBoundaryOptions(false);
	};

	const handleUpload = () => {
		if (isPointMode) {
			if (!file || !latColumn || !lngColumn || !dataColumn) {
				setError(
					"Please select latitude, longitude, and value columns",
				);
				return;
			}
			onUpload({
				file: file.name,
				headerRow,
				data: csvData,
				mode: "points",
				latColumn,
				lngColumn,
				dataColumn,
			});
			handleClose();
			return;
		}

		if (!file || !selectedColumn || !dataColumn || !effectiveMatch) {
			setError(
				"Please select a file, area code column, data column, and matching area type",
			);
			return;
		}

		if (!canVisualise) {
			setError("Postcode visualisation is coming soon.");
			return;
		}

		const entry = effectiveMatch.entry;

		onUpload({
			file: file.name,
			headerRow,
			mode: "choropleth",
			selectedColumn,
			dataColumn,
			boundaryType: entry.boundaryType,
			boundaryYear: entry.year || null,
			selectedEntry: entry,
			data: csvData,
		});

		handleClose();
	};

	const handleClose = () => {
		resetForm();
		onClose();
	};

	useEffect(() => {
		document.body.style.overflow = isOpen ? "hidden" : "";
		return () => {
			document.body.style.overflow = "";
		};
	}, [isOpen]);

	if (!isOpen) return null;

	const isSpecialType = (matchType: string) =>
		matchType === "postcode-full" ||
		matchType === "postcode-district" ||
		matchType === "coordinate";

	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button
				type="button"
				className="absolute inset-0 bg-black/20 backdrop-blur-sm"
				aria-label="Close"
				onClick={handleClose}
			/>

			<div
				style={{
					maxWidth: csvData.length > 0 ? "480px" : "360px",
					transition: "max-width 0.35s ease",
				}}
				className={`relative backdrop-blur-md border rounded-md shadow-xl w-full flex flex-col max-h-[90vh] ${isDark ? "bg-gray-900/95 border-white/10" : "bg-white/80 border-white/30"}`}
			>
				<div
					className={`flex items-center justify-between px-4 pt-2.5 pb-2 shrink-0 ${isDark ? "bg-white/5" : "bg-white/20"}`}
				>
					<h2
						className={`text-sm font-semibold ${isDark ? "text-gray-100" : "text-gray-900/80"}`}
					>
						Upload Dataset
					</h2>
					<button
						type="button"
						onClick={handleClose}
						className={`cursor-pointer transition-colors ${isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}
					>
						<X size={18} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto p-4 space-y-4">
					{error && (
						<div
							className={`p-3 border rounded-md flex items-center gap-2 text-xs ${
								isDark
									? "bg-red-900/20 border-red-800/40 text-red-400"
									: "bg-red-50 border-red-200 text-red-700"
							}`}
						>
							<AlertCircle size={14} />
							{error}
						</div>
					)}

					<input
						ref={fileInputRef}
						type="file"
						accept=".csv"
						onChange={handleFileSelect}
						className="hidden"
					/>
					{file ? (
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							className={`w-full flex items-center gap-2 px-3 py-2 rounded-md border text-xs transition-colors ${isDark ? "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10" : "border-gray-200 bg-white/60 text-gray-700 hover:bg-white/80"}`}
						>
							<Upload size={13} className="shrink-0" />
							<span className="truncate font-medium">{file.name}</span>
							<span className={`ml-auto shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Change</span>
						</button>
					) : (
						<>
							<label
								className={`block text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
							>
								Select CSV File
							</label>
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								className={`w-full border-2 border-dashed cursor-pointer rounded-md p-8 transition-colors flex flex-col items-center gap-2 ${isDark ? "border-white/20 hover:border-gray-400 text-gray-500" : "border-gray-300 hover:border-gray-400 text-gray-400"}`}
							>
								<Upload size={28} />
								<span className="text-xs font-medium">Click to select CSV file</span>
							</button>
						</>
					)}

					{csvData.length > 0 && isPointMode && (
						<div className="animate-in fade-in duration-300 space-y-4">
							<div className="flex items-center justify-between">
								<span
									className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
								>
									Detected coordinates — plotting as points
								</span>
								<RowBadge
									headerRow={headerRow}
									csvData={csvData}
									onChange={handleHeaderRowChange}
									isDark={isDark}
								/>
							</div>
							<div>
								<label
									className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
								>
									Latitude
								</label>
								<ColumnDropdown
									columns={columns}
									value={latColumn}
									onChange={setLatColumn}
									placeholder="Latitude column..."
									isDark={isDark}
								/>
							</div>
							<div>
								<label
									className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
								>
									Longitude
								</label>
								<ColumnDropdown
									columns={columns}
									value={lngColumn}
									onChange={setLngColumn}
									placeholder="Longitude column..."
									isDark={isDark}
								/>
							</div>
							<div>
								<label
									className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
								>
									Value
								</label>
								<ColumnDropdown
									columns={columns}
									value={dataColumn}
									onChange={setDataColumn}
									placeholder="Value column..."
									isDark={isDark}
								/>
							</div>
						</div>
					)}

					{csvData.length > 0 && !isPointMode && (
						<div className="animate-in fade-in duration-300 space-y-4">
							<div>
								<div className="flex items-center justify-between mb-1.5">
									<label
										className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
									>
										Area codes
									</label>
									<RowBadge
										headerRow={headerRow}
										csvData={csvData}
										onChange={handleHeaderRowChange}
										isDark={isDark}
									/>
								</div>
								<ColumnDropdown
									columns={columns}
									value={selectedColumn}
									onChange={(v) => {
										setSelectedColumn(v);
										setOverrideLabel("");
										setShowBoundaryOptions(false);
									}}
									placeholder="Select area code column..."
									isDark={isDark}
								/>

								{selectedColumn && (
									<div className="mt-2">
										{matches.length === 0 ? (
											<p className={`text-[10px] ${isDark ? "text-orange-400" : "text-orange-500"}`}>
												No boundary type matched. Try a different column.
											</p>
										) : (
											<div>
												<div className={`flex items-center gap-2 text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
													<span className={`font-semibold ${getMatchColorClass(effectiveMatch!.percentage)}`}>
														{effectiveMatch!.percentage.toFixed(0)}%
													</span>
													<span className={`truncate ${isSpecialType(effectiveMatch!.entry.matchType) ? "italic" : ""}`}>
														{effectiveMatch!.entry.label}
													</span>
													{isSpecialType(effectiveMatch!.entry.matchType) && (
														<span className={`text-[9px] shrink-0 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
															coming soon
														</span>
													)}
													{matches.length > 1 && (
														<button
															type="button"
															onClick={() => setShowBoundaryOptions(!showBoundaryOptions)}
															className={`ml-auto shrink-0 underline underline-offset-2 transition-colors ${
																isDark
																	? "text-gray-600 hover:text-gray-400"
																	: "text-gray-400 hover:text-gray-600"
															}`}
														>
															{showBoundaryOptions ? "Less" : "Change"}
														</button>
													)}
												</div>

												{showBoundaryOptions && (
													<div
														className={`mt-1.5 rounded-md border overflow-hidden ${isDark ? "border-white/10" : "border-gray-200"}`}
													>
														{matches.map((m) => {
															const special = isSpecialType(m.entry.matchType);
															return (
																<button
																	key={m.entry.label}
																	type="button"
																	disabled={special}
																	onClick={() => {
																		setOverrideLabel(m.entry.label);
																		setShowBoundaryOptions(false);
																	}}
																	className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors ${
																		special
																			? isDark ? "opacity-40 cursor-default text-gray-500" : "opacity-40 cursor-default text-gray-400"
																			: effectiveMatch?.entry.label === m.entry.label
																				? isDark ? "bg-indigo-600/25 text-indigo-200" : "bg-indigo-50 text-indigo-700"
																				: isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-600 hover:bg-gray-50"
																	}`}
																>
																	<span className={`text-[10px] w-8 text-right font-semibold ${getMatchColorClass(m.percentage)}`}>
																		{m.percentage.toFixed(0)}%
																	</span>
																	<span className="truncate">{m.entry.label}</span>
																	{special && (
																		<span className={`ml-auto text-[9px] shrink-0 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
																			coming soon
																		</span>
																	)}
																</button>
															);
														})}
													</div>
												)}
											</div>
										)}
									</div>
								)}
							</div>

							<div>
								<label
									className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
								>
									Values
								</label>
								<ColumnDropdown
									columns={columns}
									value={dataColumn}
									onChange={setDataColumn}
									placeholder="Select data column..."
									isDark={isDark}
								/>
							</div>
						</div>
					)}
				</div>

				<div
					className={`flex items-center justify-end gap-2 px-3 py-2 pb-2.5 shrink-0 ${isDark ? "bg-white/5" : "bg-white/20"}`}
				>
					<button
						type="button"
						onClick={handleClose}
						className={`cursor-pointer rounded-sm px-3 py-1 text-xs transition-colors duration-150 ${isDark ? "text-gray-400 hover:text-gray-200 hover:bg-white/10" : "text-gray-500 hover:text-gray-600 hover:bg-white/20"}`}
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleUpload}
						disabled={
							isPointMode
								? !(latColumn && lngColumn && dataColumn)
								: !canVisualise && effectiveMatch !== null
						}
						className={`cursor-pointer border rounded-sm px-3 py-1 text-xs transition-colors duration-150 shadow-sm ${isDark ? "border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-gray-100" : "border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20 text-gray-500 hover:text-gray-600"} ${(isPointMode ? !(latColumn && lngColumn && dataColumn) : !canVisualise && effectiveMatch !== null) ? "opacity-40 cursor-not-allowed" : ""}`}
					>
						Visualise
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
