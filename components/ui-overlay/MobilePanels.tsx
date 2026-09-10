import { useState, type ReactNode } from "react";

type MobilePanel = "none" | "control" | "chart";

interface MobilePanelsProps {
	isDark: boolean;
	renderControlPanel: (closePanel: () => void) => ReactNode;
	chartPanel: ReactNode;
}

function MapIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="size-5"
		>
			<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
			<line x1="9" y1="3" x2="9" y2="18" />
			<line x1="15" y1="6" x2="15" y2="21" />
		</svg>
	);
}

function BarChartIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="size-5"
		>
			<line x1="18" y1="20" x2="18" y2="10" />
			<line x1="12" y1="20" x2="12" y2="4" />
			<line x1="6" y1="20" x2="6" y2="14" />
		</svg>
	);
}

function XIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="size-5"
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}

export function MobilePanels({
	isDark,
	renderControlPanel,
	chartPanel,
}: MobilePanelsProps) {
	const [mobilePanel, setMobilePanel] = useState<MobilePanel>("none");
	const closePanel = () => setMobilePanel("none");
	const togglePanel = (panel: Exclude<MobilePanel, "none">) =>
		setMobilePanel((current) => (current === panel ? "none" : panel));

	return (
		<>
			{mobilePanel !== "none" && (
				<button
					type="button"
					className="md:hidden fixed inset-0 bg-black/30 pointer-events-auto z-10"
					aria-label="Close panel"
					onClick={closePanel}
				/>
			)}
			<div
				className={`md:hidden fixed bottom-0 left-0 right-0 pointer-events-auto z-20 transition-transform duration-300 ease-in-out ${
					mobilePanel !== "none"
						? "translate-y-0"
						: "translate-y-full"
				}`}
				style={{ maxHeight: "80vh" }}
			>
				<div
					className={`backdrop-blur-md rounded-t-2xl shadow-2xl border-t overflow-y-auto h-full ${isDark ? "bg-[rgba(12,12,24,0.92)] border-white/10" : "bg-white/95 border-white/30"}`}
				>
					<div
						className={`flex items-center justify-between px-4 py-3 border-b sticky top-0 backdrop-blur-md ${isDark ? "bg-[rgba(12,12,24,0.92)] border-white/10" : "bg-white/95 border-gray-100"}`}
					>
						<span
							className={`text-sm font-semibold ${isDark ? "text-gray-100" : "text-gray-700"}`}
						>
							{mobilePanel === "control" ? "Navigation" : "Data"}
						</span>
						<button
							type="button"
							onClick={closePanel}
							className={`p-1 rounded-full ${isDark ? "text-gray-400 hover:text-gray-200 hover:bg-white/10" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
						>
							<XIcon />
						</button>
					</div>
					<div className="overflow-y-auto">
						{mobilePanel === "control" &&
							renderControlPanel(closePanel)}
						{mobilePanel === "chart" && chartPanel}
					</div>
				</div>
			</div>

			<div className="md:hidden fixed bottom-6 left-0 right-0 flex justify-between px-4 pointer-events-auto z-30">
				<button
					type="button"
					onClick={() => togglePanel("control")}
					className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium transition-colors ${
						mobilePanel === "control"
							? "bg-indigo-600 text-white"
							: isDark
								? "bg-white/10 backdrop-blur-sm text-gray-200 hover:bg-white/15"
								: "bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white"
					}`}
				>
					<MapIcon />
					<span>Explore</span>
				</button>
				<button
					type="button"
					onClick={() => togglePanel("chart")}
					className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium transition-colors ${
						mobilePanel === "chart"
							? "bg-indigo-600 text-white"
							: isDark
								? "bg-white/10 backdrop-blur-sm text-gray-200 hover:bg-white/15"
								: "bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white"
					}`}
				>
					<BarChartIcon />
					<span>Data</span>
				</button>
			</div>
		</>
	);
}
