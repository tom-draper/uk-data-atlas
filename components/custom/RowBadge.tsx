import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export function RowBadge({
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
