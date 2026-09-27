import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Upload, AlertCircle } from "lucide-react";
import { detectCoordinateColumns, AreaBank } from "@lib/data/areaBank";
import { detectHeaderRow, parseCustomCsv } from "@/lib/data/custom/csv";
import {
	buildCustomImport,
	canVisualise,
	chooseMatch,
	guessCodeColumn,
	guessParentColumn,
	guessValueColumn,
	importWarnings,
	isPointMode,
	matchColumn,
	uploadColumns,
} from "@/lib/data/custom/upload";
import type { CustomImport } from "@/lib/data/custom/import";
import { useIsDark } from "@/lib/context/ThemeContext";
import { BoundaryColumnFields } from "./BoundaryColumnFields";
import { PointColumnFields } from "./PointColumnFields";
import { ColumnDropdown } from "./ColumnDropdown";

export function UploadModal({
	isOpen,
	onClose,
	onUpload,
	areaBank,
}: {
	isOpen: boolean;
	onClose: () => void;
	onUpload: (customImport: CustomImport) => void;
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
	/** The reader's parent column; "" is an explicit "None", null not chosen. */
	const [parentChoice, setParentChoice] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const isDark = useIsDark();

	const columns = uploadColumns(csvData, headerRow);
	const matches = matchColumn(csvData, headerRow, selectedColumn, areaBank);
	const effectiveMatch = chooseMatch(matches, overrideLabel);
	const visualisable = canVisualise(effectiveMatch);

	// Route CSVs that carry lat/lng (and don't strongly match a boundary set) to
	// the point-plotting flow.
	const coord = useMemo(
		() => detectCoordinateColumns(csvData, headerRow),
		[csvData, headerRow],
	);
	const pointMode = isPointMode(coord, matches);

	// A local authority column settles wards that share a name. Until the
	// reader picks one (or "None"), a header that looks like one is used.
	const parentGuess = useMemo(
		() => guessParentColumn(csvData[headerRow] ?? [], selectedColumn),
		[csvData, headerRow, selectedColumn],
	);
	const parentColumn = parentChoice ?? parentGuess ?? "";

	const draft = useMemo(
		() => ({
			file: file?.name ?? null,
			csvData,
			headerRow,
			selectedColumn,
			dataColumn,
			latColumn,
			lngColumn,
			parentColumn,
		}),
		[
			file,
			csvData,
			headerRow,
			selectedColumn,
			dataColumn,
			latColumn,
			lngColumn,
			parentColumn,
		],
	);

	// Rows the upload would leave off, shown before it is applied, and whether
	// any of them could be settled by a parent column. The match entry comes
	// from the area bank, so it is stable across renders.
	const matchEntry = effectiveMatch?.entry;
	const { warnings, hasSharedNames } = useMemo(() => {
		const warnings = importWarnings(draft, pointMode, effectiveMatch);
		const hasSharedNames =
			!!matchEntry?.parentsOf &&
			importWarnings(
				{ ...draft, parentColumn: "" },
				pointMode,
				effectiveMatch,
			).some((warning) => warning.code === "ambiguous-name");
		return { warnings, hasSharedNames };
	}, [draft, pointMode, matchEntry]);

	// Prefill the lat/lng/value pickers from detection when entering point mode.
	useEffect(() => {
		if (!coord || csvData.length === 0) return;
		const hdrs = csvData[headerRow] ?? [];
		setLatColumn(hdrs[coord.latIdx] ?? "");
		setLngColumn(hdrs[coord.lngIdx] ?? "");
		const valueColumn = guessValueColumn(csvData, headerRow, coord);
		if (valueColumn) setDataColumn(valueColumn);
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
		setParentChoice(null);
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

			const codeColumn = guessCodeColumn(rows[detectedHeader] ?? []);
			if (codeColumn) setSelectedColumn(codeColumn);
		};
		reader.readAsText(selectedFile);
	};

	const handleSelectedColumnChange = (value: string) => {
		setSelectedColumn(value);
		setParentChoice(null);
		setOverrideLabel("");
		setShowBoundaryOptions(false);
	};

	const handleOverride = (label: string) => {
		setOverrideLabel(label);
		setShowBoundaryOptions(false);
	};

	const handleHeaderRowChange = (row: number) => {
		setHeaderRow(row);
		setSelectedColumn("");
		setParentChoice(null);
		setDataColumn("");
		setOverrideLabel("");
		setShowBoundaryOptions(false);
	};

	const handleUpload = () => {
		const result = buildCustomImport(draft, pointMode, effectiveMatch);
		if ("error" in result) {
			setError(result.error);
			return;
		}

		onUpload(result.customImport);
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
							<span className="truncate font-medium">
								{file.name}
							</span>
							<span
								className={`ml-auto shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`}
							>
								Change
							</span>
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
								<span className="text-xs font-medium">
									Click to select CSV file
								</span>
							</button>
						</>
					)}

					{csvData.length > 0 && pointMode && (
						<PointColumnFields
							columns={columns}
							csvData={csvData}
							headerRow={headerRow}
							onHeaderRowChange={handleHeaderRowChange}
							latColumn={latColumn}
							onLatColumnChange={setLatColumn}
							lngColumn={lngColumn}
							onLngColumnChange={setLngColumn}
							dataColumn={dataColumn}
							onDataColumnChange={setDataColumn}
							isDark={isDark}
						/>
					)}

					{csvData.length > 0 && !pointMode && (
						<BoundaryColumnFields
							columns={columns}
							csvData={csvData}
							headerRow={headerRow}
							onHeaderRowChange={handleHeaderRowChange}
							selectedColumn={selectedColumn}
							onSelectedColumnChange={handleSelectedColumnChange}
							dataColumn={dataColumn}
							onDataColumnChange={setDataColumn}
							matches={matches}
							effectiveMatch={effectiveMatch}
							showBoundaryOptions={showBoundaryOptions}
							onToggleBoundaryOptions={() =>
								setShowBoundaryOptions(!showBoundaryOptions)
							}
							onOverride={handleOverride}
							isDark={isDark}
						/>
					)}

					{csvData.length > 0 && !pointMode && hasSharedNames && (
						<div>
							<div className="flex items-center justify-between mb-1.5">
								<label
									className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
								>
									{matchEntry?.parentLabel ?? "Parent area"}
									<span
										className={`ml-1.5 font-normal ${isDark ? "text-gray-500" : "text-gray-400"}`}
									>
										to tell shared names apart
									</span>
								</label>
								{parentColumn && (
									<button
										type="button"
										onClick={() => setParentChoice("")}
										className={`text-[10px] underline underline-offset-2 ${isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}
									>
										None
									</button>
								)}
							</div>
							<ColumnDropdown
								columns={columns.filter(
									(column) => column.name !== selectedColumn,
								)}
								value={parentColumn}
								onChange={setParentChoice}
								placeholder="Select a column naming each row's local authority..."
								isDark={isDark}
							/>
						</div>
					)}

					{warnings.map((warning) => (
						<div
							key={warning.code}
							role="status"
							className={`p-3 border rounded-md flex items-start gap-2 text-xs ${
								isDark
									? "bg-amber-900/20 border-amber-800/40 text-amber-300"
									: "bg-amber-50 border-amber-200 text-amber-800"
							}`}
						>
							<AlertCircle size={14} className="shrink-0 mt-px" />
							<span>
								{warning.message}
								{warning.names && warning.names.length > 0 && (
									<> Shared: {warning.names.join(", ")}</>
								)}
							</span>
						</div>
					))}
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
							pointMode
								? !(latColumn && lngColumn && dataColumn)
								: !visualisable && effectiveMatch !== null
						}
						className={`cursor-pointer border rounded-sm px-3 py-1 text-xs transition-colors duration-150 shadow-sm ${isDark ? "border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-gray-100" : "border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20 text-gray-500 hover:text-gray-600"} ${(pointMode ? !(latColumn && lngColumn && dataColumn) : !visualisable && effectiveMatch !== null) ? "opacity-40 cursor-not-allowed" : ""}`}
					>
						Visualise
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
