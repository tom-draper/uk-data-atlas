import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export function ColumnDropdown({
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
