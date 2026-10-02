import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import TitlePane from "@components/TitlePane";
import PanelHeader from "@components/PanelHeader";
import GlassOverlays from "@components/GlassOverlays";
import { glassStyle, panelTheme } from "@/lib/helpers/panelTheme";

interface MobilePanelsProps {
	isDark: boolean;
	activeChartCard: ReactNode;
	renderChartPanel: (closePanel: () => void) => ReactNode;
	renderLocationPanel: (closePanel: () => void) => ReactNode;
	mapOptions: ReactNode;
	legend: ReactNode;
}

// Even gutters, kept clear of notches and the home indicator.
const GUTTER = "0.625rem";
const gutters: CSSProperties = {
	gap: GUTTER,
	paddingTop: `max(${GUTTER}, env(safe-area-inset-top))`,
	paddingRight: `max(${GUTTER}, env(safe-area-inset-right))`,
	paddingBottom: `max(${GUTTER}, env(safe-area-inset-bottom))`,
	paddingLeft: `max(${GUTTER}, env(safe-area-inset-left))`,
};

type MiddlePanel = "none" | "menu" | "locations" | "charts" | "mapOptions";

const GITHUB_URL = "https://github.com/tom-draper/uk-data-atlas";

function MenuIcon({ open }: { open: boolean }) {
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
			{open ? (
				<>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</>
			) : (
				<>
					<line x1="4" y1="7" x2="20" y2="7" />
					<line x1="4" y1="12" x2="20" y2="12" />
					<line x1="4" y1="17" x2="20" y2="17" />
				</>
			)}
		</svg>
	);
}

function MenuList({
	isDark,
	legendShown,
	onOpen,
	onToggleLegend,
}: {
	isDark: boolean;
	legendShown: boolean;
	onOpen: (panel: Exclude<MiddlePanel, "none" | "menu">) => void;
	onToggleLegend: () => void;
}) {
	const t = panelTheme(isDark);
	// Matches the rows of the location list.
	const item = `block w-full text-left px-2 py-1.5 rounded transition-colors text-xs cursor-pointer ${isDark ? "hover:bg-white/10 text-gray-400 hover:text-gray-200" : "hover:bg-white/40 text-gray-600 hover:text-gray-800"}`;

	return (
		<nav
			className={`pointer-events-auto rounded-md relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
			style={glassStyle(isDark)}
			aria-label="Atlas menu"
		>
			<GlassOverlays isDark={isDark} />
			<div className="relative p-1" style={{ zIndex: 1 }}>
				<button
					type="button"
					className={item}
					onClick={() => onOpen("locations")}
				>
					Locations
				</button>
				<button
					type="button"
					className={item}
					onClick={() => onOpen("charts")}
				>
					Datasets
				</button>
				<button
					type="button"
					className={item}
					onClick={() => onOpen("mapOptions")}
				>
					Map Options
				</button>
				<button type="button" className={item} onClick={onToggleLegend}>
					{legendShown ? "Hide Legend" : "Show Legend"}
				</button>
				<div className={`mx-2 my-1 border-t ${t.border}`} />
				<Link href="/sources" className={item}>
					Sources
				</Link>
				<a
					href={GITHUB_URL}
					target="_blank"
					rel="noopener noreferrer"
					className={item}
				>
					GitHub
				</a>
			</div>
		</nav>
	);
}

/**
 * The mobile layout: the title at the top and the card of the dataset on the
 * map at the bottom, under the chart panel's header so the location is always
 * in view, leaving the map visible between them.
 *
 * The gap holds one pane at a time. The title's menu lists the panes that can
 * open there, and tapping the card opens every chart there; choosing a chart
 * pins it at the bottom and closes them again. The legend, when shown, sits at
 * the top of the gap while no pane is open.
 */
export function MobilePanels({
	isDark,
	activeChartCard,
	renderChartPanel,
	renderLocationPanel,
	mapOptions,
	legend,
}: MobilePanelsProps) {
	const [panel, setPanel] = useState<MiddlePanel>("none");
	const [legendShown, setLegendShown] = useState(true);
	const closePanel = () => setPanel("none");

	return (
		<div
			className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto]"
			style={gutters}
		>
			<div className="pointer-events-auto">
				<TitlePane
					end={
						<button
							type="button"
							className={`flex items-center px-2.5 h-9 cursor-pointer ${isDark ? "text-gray-300" : "text-gray-600"}`}
							aria-label={
								panel === "none" ? "Open menu" : "Close menu"
							}
							aria-expanded={panel !== "none"}
							onClick={() =>
								setPanel((current) =>
									current === "none" ? "menu" : "none",
								)
							}
						>
							<MenuIcon open={panel !== "none"} />
						</button>
					}
				/>
			</div>
			<div className="min-h-0">
				{panel === "menu" && (
					<MenuList
						isDark={isDark}
						legendShown={legendShown}
						onOpen={setPanel}
						onToggleLegend={() => {
							setLegendShown((shown) => !shown);
							closePanel();
						}}
					/>
				)}
				{panel === "locations" && (
					<div className="pointer-events-auto h-full">
						{renderLocationPanel(closePanel)}
					</div>
				)}
				{panel === "charts" && renderChartPanel(closePanel)}
				{panel === "mapOptions" && (
					<div className="pointer-events-auto">{mapOptions}</div>
				)}
				{panel === "none" && legendShown && legend}
			</div>
			<div
				className={`pointer-events-auto rounded-md relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
				style={glassStyle(isDark)}
			>
				<GlassOverlays isDark={isDark} />
				<div className="relative" style={{ zIndex: 1 }}>
					<PanelHeader />
					<div
						className="px-2.5 pt-2 pb-2.5 not-has-[[data-active=true]]:hidden"
						onClick={() =>
							setPanel((current) =>
								current === "charts" ? "none" : "charts",
							)
						}
					>
						{activeChartCard}
					</div>
				</div>
			</div>
		</div>
	);
}
