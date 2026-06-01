"use client";
import { useId } from "react";
import { glassSpecular } from "@/lib/helpers/panelTheme";

/**
 * The stacked overlays that give a glass panel its liquid-glass look:
 * a refraction ripple, a soft top-left glow, and a bright specular streak
 * across the top edge. Drop this in as the first child of any panel whose
 * wrapper uses `glassStyle()` and is `relative overflow-hidden`, then keep
 * the real content above it with `position: relative; zIndex: 1`.
 */
export default function GlassOverlays({ isDark }: { isDark: boolean }) {
	// Unique filter id per instance so multiple panels don't collide
	const filterId = `glass-distortion-${useId().replace(/:/g, "")}`;

	return (
		<>
			{/* Refraction layer: warps whatever sits behind the pane for a liquid-glass ripple */}
			<div
				aria-hidden="true"
				style={{
					position: "absolute",
					inset: 0,
					borderRadius: "inherit",
					pointerEvents: "none",
					zIndex: 0,
					backdropFilter: "blur(2px)",
					WebkitBackdropFilter: "blur(2px)",
					filter: `url(#${filterId})`,
				}}
			/>
			{/* Soft radial glow at top-left */}
			<div style={glassSpecular(isDark)} />
			{/* Bright specular streak across the top edge, like light on a glass lip */}
			<div
				aria-hidden="true"
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					height: "45%",
					borderRadius: "inherit",
					pointerEvents: "none",
					zIndex: 0,
					background: isDark
						? "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 30%, transparent 100%)"
						: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 35%, transparent 100%)",
				}}
			/>
			{/* SVG distortion filter definition */}
			<svg className="absolute w-0 h-0" aria-hidden="true">
				<defs>
					<filter
						id={filterId}
						x="-10%"
						y="-10%"
						width="120%"
						height="120%"
					>
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.012 0.018"
							numOctaves="2"
							seed="5"
							result="noise"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="noise"
							scale="8"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
					</filter>
				</defs>
			</svg>
		</>
	);
}
