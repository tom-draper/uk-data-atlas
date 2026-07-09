import { useMemo, useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import { createPortal } from "react-dom";
import { X, Upload, AlertCircle, ChevronDown } from "lucide-react";
import {
	ActiveViz,
	BoundaryType,
	CustomDataset,
	BoundaryCodes,
} from "@/lib/types";
import { CustomPoint } from "@/lib/types/custom";
import {
	matchColumnAgainstBank,
	detectCoordinateColumns,
	AreaEntry,
	AreaBank,
} from "@lib/data/areaBank";
import { useMatchIndex } from "@/lib/hooks/useMatchIndex";
import { BoundaryData } from "@lib/types/boundaries";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import { getColor } from "@/lib/helpers/colorScale/themes";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	useCardAccent,
	cardClass,
	chartHeadingClass,
} from "@/lib/hooks/useCardAccent";

interface UploadData {
	file: string;
	headerRow: number;
	data: string[][];
	mode: "choropleth" | "points";
	dataColumn: string;
	// choropleth
	selectedColumn?: string;
	boundaryType?: string;
	boundaryYear?: number | null;
	year?: number | null;
	selectedEntry?: AreaEntry;
	// points
	latColumn?: string;
	lngColumn?: string;
}

interface SelectedArea {
	code: string;
	name: string;
	type: BoundaryType;
}

function parseCSV(text: string): string[][] {
	const result = Papa.parse<string[]>(text, {
		skipEmptyLines: true,
		transform: (val) => val.trim(),
	});
	return result.data;
}

function getMatchColorClass(percentage: number): string {
	if (percentage >= 80) return "text-green-600";
	if (percentage >= 50) return "text-yellow-600";
	if (percentage > 0) return "text-orange-600";
	return "text-gray-500/80";
}


function detectHeaderRow(rows: string[][]): number {
	if (rows.length === 0) return 0;

	const isNumeric = (v: string) => v.trim() !== "" && !isNaN(Number(v.trim()));

	// Max number of non-empty cells across the first 20 rows
	const maxCols = Math.max(...rows.slice(0, 20).map(
		(r) => r.filter((c) => c.trim() !== "").length,
	));

	for (let i = 0; i < Math.min(rows.length, 20); i++) {
		const row = rows[i];
		const nonEmpty = row.filter((c) => c.trim() !== "");
		if (nonEmpty.length < maxCols) continue; // row doesn't span full width
		const numericCount = nonEmpty.filter(isNumeric).length;
		const textRatio = (nonEmpty.length - numericCount) / nonEmpty.length;
		if (textRatio >= 0.5) return i; // majority text cells → likely a header
	}

	return 0;
}

function ColumnDropdown({
	columns,
	value,
	onChange,
	placeholder,
	isDark,
}: {
	columns: { name: string; preview: string; index: number }[];
	value: string;
	onChange: (name: string) => void;
	placeholder: string;
	isDark: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
	const triggerRef = useRef<HTMLButtonElement>(null);

	const openDropdown = () => {
		const rect = triggerRef.current?.getBoundingClientRect();
		if (rect) setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
		setOpen(true);
	};

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				onClick={() => (open ? setOpen(false) : openDropdown())}
				className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-xs transition-colors ${
					isDark
						? `border-white/10 ${open ? "bg-white/10 border-white/20" : "bg-white/5 hover:bg-white/10"}`
						: `border-gray-200 ${open ? "bg-white border-gray-300 shadow-sm" : "bg-white/60 hover:bg-white"}`
				}`}
			>
				<span
					className={`truncate font-medium ${
						value
							? isDark ? "text-gray-200" : "text-gray-700"
							: isDark ? "text-gray-500" : "text-gray-400"
					}`}
				>
					{value || placeholder}
				</span>
				<ChevronDown
					size={12}
					className={`shrink-0 transition-transform duration-150 ${isDark ? "text-gray-500" : "text-gray-400"} ${open ? "rotate-180" : ""}`}
				/>
			</button>

			{open &&
				createPortal(
					<>
						<div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
						<div
							className={`fixed z-[71] rounded-md border shadow-xl overflow-y-auto ${
								isDark ? "bg-gray-900 border-white/15" : "bg-white border-gray-200"
							}`}
							style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: 240 }}
						>
							{columns.map((col) => (
								<button
									key={col.index}
									type="button"
									onClick={() => { onChange(col.name); setOpen(false); }}
									className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors ${
										col.name === value
											? isDark
												? "bg-indigo-600/25 text-indigo-200"
												: "bg-indigo-50 text-indigo-700"
											: isDark
												? "text-gray-300 hover:bg-white/5"
												: "text-gray-700 hover:bg-gray-50"
									}`}
								>
									<span className="font-medium truncate min-w-0">
										{col.name || `Column ${col.index + 1}`}
									</span>
									{col.preview && (
										<span
											className={`shrink-0 tabular-nums truncate ${isDark ? "text-gray-600" : "text-gray-400"}`}
											style={{ maxWidth: "45%" }}
										>
											{col.preview}
										</span>
									)}
								</button>
							))}
						</div>
					</>,
					document.body,
				)}
		</>
	);
}

function RowBadge({
	headerRow,
	csvData,
	onChange,
	isDark,
}: {
	headerRow: number;
	csvData: string[][];
	onChange: (row: number) => void;
	isDark: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState({ top: 0, right: 0 });
	const triggerRef = useRef<HTMLButtonElement>(null);

	const openPicker = () => {
		const rect = triggerRef.current?.getBoundingClientRect();
		if (rect) setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
		setOpen(true);
	};

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				onClick={() => (open ? setOpen(false) : openPicker())}
				className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
					isDark
						? "text-gray-500 hover:text-gray-400 hover:bg-white/5"
						: "text-gray-400 hover:text-gray-500 hover:bg-black/5"
				}`}
			>
				Row {headerRow + 1}
				<ChevronDown size={9} />
			</button>

			{open &&
				createPortal(
					<>
						<div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
						<div
							className={`fixed z-[71] rounded-md border shadow-lg overflow-hidden min-w-52 ${
								isDark ? "bg-gray-900 border-white/15" : "bg-white border-gray-200"
							}`}
							style={{ top: pos.top, right: pos.right }}
						>
							{csvData.slice(0, Math.min(6, csvData.length)).map((row, i) => (
								<button
									key={i}
									type="button"
									onClick={() => { onChange(i); setOpen(false); }}
									className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
										i === headerRow
											? isDark
												? "bg-indigo-600/25 text-indigo-200"
												: "bg-indigo-50 text-indigo-700"
											: isDark
												? "text-gray-400 hover:bg-white/5"
												: "text-gray-600 hover:bg-gray-50"
									}`}
								>
									<span className={`shrink-0 w-5 text-right text-[10px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>
										{i + 1}
									</span>
									<span className="truncate">
										{row.filter(Boolean).slice(0, 5).join(", ")}
									</span>
								</button>
							))}
						</div>
					</>,
					document.body,
				)}
		</>
	);
}

function UploadModal({
	isOpen,
	onClose,
	onUpload,
	areaBank,
}: {
	isOpen: boolean;
	onClose: () => void;
	onUpload: (data: UploadData) => void;
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
			const rows = parseCSV(text);
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
			year: entry.year || null,
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

function CustomDatasetCard({
	customDataset,
	selectedArea,
	isActive,
	setActiveViz,
	codeMapper,
	mapManager,
	boundaryData,
	location,
}: {
	customDataset: CustomDataset;
	selectedArea: SelectedArea | null;
	isActive: boolean;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper: CodeMapper;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();

	const aggregatedData = useMemo(
		() =>
			aggregateDataset(
				{
					datasets: { [customDataset.year]: customDataset },
					boundaryType: customDataset.boundaryType,
					calculateStats: (mm, g, d, loc, id) =>
						mm.calculateCustomDatasetStats(g, d, loc, id),
				},
				mapManager,
				boundaryData,
				location,
			),
		[customDataset, mapManager, boundaryData, location],
	);
	const displayValue = (() => {
		if (!customDataset || !customDataset.data) return null;

		if (selectedArea) {
			const value = customDataset.data[selectedArea.code];

			if (value !== undefined) {
				return { value, count: 1 };
			}

			// Try to make the code to a different year
			if (codeMapper && customDataset.boundaryYear) {
				const mappedCode = codeMapper.getCodeForYear(
					selectedArea.type,
					selectedArea.code,
					customDataset.boundaryYear,
				);
				if (mappedCode) {
					const mappedValue = customDataset.data[mappedCode];
					if (mappedValue !== undefined) {
						return { value: mappedValue, count: 1 };
					}
				}
			}

			// Aggregate wards for local authority
			if (
				selectedArea.type === "localAuthority" &&
				codeMapper &&
				customDataset.boundaryYear
			) {
				const wardCodes = codeMapper.getWardsForLad(
					selectedArea.code,
					customDataset.boundaryYear,
				);

				if (wardCodes.length > 0) {
					let sum = 0;
					let count = 0;

					for (const wardCode of wardCodes) {
						let value = customDataset.data[wardCode];

						// Try to map ward code to dataset year if not found
						if (value === undefined) {
							const mappedCode = codeMapper.getCodeForYear(
								"ward",
								wardCode,
								customDataset.boundaryYear,
							);
							if (mappedCode) {
								value = customDataset.data[mappedCode];
							}
						}

						if (value !== undefined) {
							sum += value;
							count++;
						}
					}

					if (count > 0) {
						return { value: sum, count };
					}
				}
			}
		}

		if (aggregatedData && aggregatedData[customDataset.year]) {
			const average = aggregatedData[customDataset.year].average;
			const count = aggregatedData[customDataset.year].count;
			return { value: average, count };
		}

		return null;
	})();

	const handleActivate = () => {
		setActiveViz({
			vizId: customDataset.id,
			datasetType: "custom",
			datasetYear: customDataset.boundaryYear,
		});
	};

	if (!customDataset) return null;

	const allValues = Object.values(customDataset.data);
	const dataMin = allValues.length ? Math.min(...allValues) : 0;
	const dataMax = allValues.length ? Math.max(...allValues) : 100;
	const range = dataMax - dataMin || 1;

	const barWidth = displayValue
		? Math.max(0, Math.min(((displayValue.value - dataMin) / range) * 100, 100))
		: 0;
	const valueColor = displayValue ? getColor(barWidth / 100) : "#6366f1";

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		displayValue ? valueColor : null,
		isActive,
		isDark,
	);

	const hasData = displayValue !== null;

	if (customDataset.kind === "points") {
		const pts = customDataset.points ?? [];
		return (
			<button
				type="button"
				onClick={handleActivate}
				style={style}
				className={cardClass(isActive, isDark, "h-20")}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			>
				<ChartLoadingBackground />
				<div className="relative z-10 flex items-start justify-between mb-1.5 shrink-0">
					<h3 className={chartHeadingClass(isDark)}>
						{customDataset.dataColumn}
					</h3>
				</div>
				<div className="flex-1 flex flex-col gap-1">
					<div className="flex items-baseline gap-2">
						<span
							className="text-2xl font-bold leading-none"
							style={{ color: "#6366f1" }}
						>
							{pts.length.toLocaleString("en-GB")}
						</span>
						<span
							className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
						>
							points
						</span>
					</div>
					{pts.length > 0 && (
						<span
							className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
						>
							{customDataset.valueMin?.toLocaleString("en-GB")} –{" "}
							{customDataset.valueMax?.toLocaleString("en-GB")}
						</span>
					)}
				</div>
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={handleActivate}
			style={style}
			className={cardClass(isActive, isDark, "h-20")}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<ChartLoadingBackground />
			<div className="relative z-10 flex items-start justify-between mb-1.5 shrink-0">
				<h3 className={chartHeadingClass(isDark)}>
					{customDataset.dataColumn} [{customDataset.boundaryYear}]
				</h3>
			</div>

			{!hasData ? (
				<div className="flex-1 mt-1">
					{chartsLoading ? (
						<ChartContentPlaceholder className="h-full" />
					) : (
						<div className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}>
							No data available
						</div>
					)}
				</div>
			) : (
				<div className="flex-1 flex flex-col gap-1">
					<div className="flex items-baseline justify-between">
						<div className="leading-none">
							<span className="text-2xl font-bold leading-none" style={{ color: valueColor }}>
								{displayValue!.value.toLocaleString("en-GB", {
									minimumFractionDigits: 0,
									maximumFractionDigits: 2,
								})}
							</span>
						</div>
						<span className={`text-[9px] ${displayValue!.count > 1 ? "" : "invisible"} ${isDark ? "text-gray-500" : "text-gray-400"}`}>
							{displayValue!.count} wards avg
						</span>
					</div>
					<div className={`h-1.5 rounded-xs overflow-hidden ${isDark ? "bg-white/10" : "bg-black/8"}`}>
						<div
							className="h-full rounded-xs transition-all duration-300"
							style={{ width: `${barWidth}%`, backgroundColor: valueColor }}
						/>
					</div>
				</div>
			)}
		</button>
	);
}

export default function CustomSection({
	customDatasets,
	addCustomDataset,
	selectedArea,
	boundaryCodes: _boundaryCodes,
	activeViz,
	setActiveViz,
	codeMapper,
	mapManager,
	boundaryData,
	location,
}: {
	customDatasets: CustomDataset[];
	addCustomDataset: (dataset: CustomDataset) => void;
	selectedArea: SelectedArea | null;
	boundaryCodes: BoundaryCodes;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper?: CodeMapper;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}) {
	const [isOpen, setIsOpen] = useState(false);
	// Match index loads lazily only while the upload modal is open.
	const { areaBank } = useMatchIndex(isOpen);
	const isDark = useIsDark();

	const handleCustomDatasetApply = (data: UploadData) => {
		const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
		const headers = data.data[data.headerRow] ?? [];

		if (data.mode === "points") {
			const latIdx = headers.indexOf(data.latColumn ?? "");
			const lngIdx = headers.indexOf(data.lngColumn ?? "");
			const valIdx = headers.indexOf(data.dataColumn);
			if (latIdx === -1 || lngIdx === -1 || valIdx === -1) return;

			const points: CustomPoint[] = [];
			let min = Infinity;
			let max = -Infinity;
			data.data.slice(data.headerRow + 1).forEach((row) => {
				const lat = parseFloat(row[latIdx]);
				const lng = parseFloat(row[lngIdx]);
				const value = parseFloat(row[valIdx]);
				if (isNaN(lat) || isNaN(lng) || isNaN(value)) return;
				points.push({ lat, lng, value });
				if (value < min) min = value;
				if (value > max) max = value;
			});

			const pointDataset: CustomDataset = {
				id,
				type: "custom",
				kind: "points",
				name: data.file,
				year: 0,
				boundaryType: "ward",
				boundaryYear: 0,
				dataColumn: data.dataColumn,
				data: {},
				points,
				valueMin: points.length ? min : 0,
				valueMax: points.length ? max : 0,
			};

			addCustomDataset(pointDataset);
			setActiveViz({ vizId: id, datasetType: "custom", datasetYear: 0 });
			setIsOpen(false);
			return;
		}

		if (
			data.boundaryYear === null ||
			data.boundaryYear === undefined ||
			!data.boundaryType ||
			!data.selectedColumn
		) {
			return;
		}

		const columnIndex = headers.indexOf(data.selectedColumn);
		const dataIndex = headers.indexOf(data.dataColumn);

		const newDataset: CustomDataset = {
			id,
			type: "custom",
			kind: "choropleth",
			name: data.file,
			year: data.boundaryYear,
			boundaryType: data.boundaryType as BoundaryType,
			boundaryYear: data.boundaryYear,
			dataColumn: data.dataColumn,
			data: {},
		};

		const nameToCode =
			data.selectedEntry?.matchType === "name"
				? data.selectedEntry.nameToCode
				: null;

		data.data.slice(data.headerRow + 1).forEach((row) => {
			let code = row[columnIndex]?.trim();
			const value = parseFloat(row[dataIndex]);

			if (nameToCode && code) {
				code = nameToCode.get(code.toLowerCase()) ?? code;
			}

			if (code && !isNaN(value)) {
				newDataset.data[code] = value;
			}
		});

		addCustomDataset(newDataset);
		setActiveViz({
			vizId: id,
			datasetType: "custom",
			datasetYear: data.boundaryYear,
		});

		setIsOpen(false);
	};

	return (
		<>
			<div
				className={`space-y-2 border-t pt-4 pb-2 ${isDark ? "border-white/10" : "border-gray-200"}`}
			>
				<h3
					className={`text-xs font-bold ${isDark ? "text-gray-200" : "text-gray-700"}`}
				>
					Custom Dataset
				</h3>

				{customDatasets.map((ds) =>
					codeMapper ? (
						<CustomDatasetCard
							key={ds.id}
							customDataset={ds}
							selectedArea={selectedArea}
							isActive={activeViz.datasetType === "custom" && activeViz.vizId === ds.id}
							setActiveViz={setActiveViz}
							codeMapper={codeMapper}
							mapManager={mapManager}
							boundaryData={boundaryData}
							location={location}
						/>
					) : (
						<div
							key={ds.id}
							className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}
						>
							Loading…
						</div>
					),
				)}

				<button
					type="button"
					onClick={() => setIsOpen(true)}
					className={`w-full h-20 p-3 rounded-md transition-colors duration-150 border-2 border-dashed cursor-pointer ${
						isDark
							? "border-white/20 hover:border-gray-400 text-gray-500"
							: "border-gray-300/80 hover:border-gray-400 text-gray-400/80"
					}`}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth="2"
						stroke="currentColor"
						className="size-6 mx-auto mb-0.5"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M12 4.5v15m7.5-7.5h-15"
						/>
					</svg>
					<span className="text-xs font-medium">Upload Dataset</span>
				</button>
			</div>

			<UploadModal
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				onUpload={handleCustomDatasetApply}
				areaBank={areaBank}
			/>
		</>
	);
}
