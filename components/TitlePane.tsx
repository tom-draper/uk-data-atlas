"use client";
import Image from "next/image";
import { useIsDark } from "@/lib/context/ThemeContext";
import { panelTheme, glassStyle } from "@/lib/helpers/panelTheme";
import GlassOverlays from "./GlassOverlays";
import packageJson from "../package.json";

export default function TitlePane() {
	const isDark = useIsDark();
	const t = panelTheme(isDark);

	return (
		<div
			className={`text-sm rounded-md relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
			style={glassStyle(isDark)}
		>
			<GlassOverlays isDark={isDark} />
			<div
				className={`relative flex items-center ${t.section} rounded-t-md`}
				style={{ zIndex: 1 }}
			>
				<a
					href="https://github.com/tom-draper/uk-data-atlas"
					target="_blank"
					rel="noopener noreferrer"
					aria-label="View on GitHub"
				>
					<Image
						src="/union-jack.png"
						alt="UK Data Atlas Logo"
						width={72}
						height={36}
						className="h-9 opacity-60 -m-px mr-3 rounded-r-md transform scale-x-[-1]"
						style={{
							filter: "contrast(0.2) grayscale(1) brightness(1.8)",
						}}
					/>
				</a>
				<h1
					className={`flex items-center text-[15px] font-semibold tracking-tight ${t.heading}`}
				>
					UK Data Atlas
					<span
						className={`ml-2 inline-flex rounded-full px-2 py-0.5 font-mono text-[11px] font-normal ring-1 ${
							isDark
								? "bg-white/10 text-gray-400 ring-white/10"
								: "bg-white/60 text-slate-500 ring-slate-900/5"
						}`}
					>
						v{packageJson.version}
					</span>
				</h1>
			</div>
		</div>
	);
}
