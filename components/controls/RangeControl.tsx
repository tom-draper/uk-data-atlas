"use client";

import { useState, useEffect, useRef } from "react";

export interface RangeControlProps {
	min: number;
	max: number;
	currentMin: number;
	currentMax: number;
	gradient: string;
	labels: string[];
	opacity?: number;
	onRangeInput: (min: number, max: number) => void;
	onRangeChangeEnd: () => void;
}

export function RangeControl({
	min,
	max,
	currentMin,
	currentMax,
	gradient,
	labels,
	opacity = 1,
	onRangeInput,
	onRangeChangeEnd,
}: RangeControlProps) {
	const [isDraggingMin, setIsDraggingMin] = useState(false);
	const [isDraggingMax, setIsDraggingMax] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const getValueFromPosition = (clientY: number) => {
		if (!containerRef.current) return currentMax;
		const rect = containerRef.current.getBoundingClientRect();
		const relativeY = clientY - rect.top;
		const percentage = Math.max(0, Math.min(1, relativeY / rect.height));
		return max - percentage * (max - min);
	};

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (isDraggingMin) {
				const newMin = Math.min(
					getValueFromPosition(e.clientY),
					currentMax - (max - min) * 0.05,
				);
				onRangeInput(Math.max(newMin, min), currentMax);
			} else if (isDraggingMax) {
				const newMax = Math.max(
					getValueFromPosition(e.clientY),
					currentMin + (max - min) * 0.05,
				);
				onRangeInput(currentMin, Math.min(newMax, max));
			}
		};

		const handleMouseUp = () => {
			if (isDraggingMin || isDraggingMax) {
				setIsDraggingMin(false);
				setIsDraggingMax(false);
				onRangeChangeEnd();
			}
		};

		if (isDraggingMin || isDraggingMax) {
			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
			return () => {
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};
		}
	}, [
		isDraggingMin,
		isDraggingMax,
		currentMin,
		currentMax,
		min,
		max,
		onRangeInput,
		onRangeChangeEnd,
	]);

	const maxPosition = ((max - currentMax) / (max - min)) * 100;
	const minPosition = ((max - currentMin) / (max - min)) * 100;

	return (
		<div className="p-1 relative select-none">
			<div className="flex flex-col justify-between h-40 text-[10px] text-gray-400/80 pointer-events-none text-right mr-8">
				{labels.map((label, i) => (
					<span key={i}>{label}</span>
				))}
			</div>
			<div
				ref={containerRef}
				className="h-40 w-6 rounded relative -mt-40 ml-auto"
			>
				<div className="absolute inset-0 rounded" style={{ background: gradient, opacity }} />
				{/* Max handle (top) */}
				<div
					className="absolute left-0 w-full h-0.5 bg-white shadow-md cursor-ns-resize group z-10"
					style={{ top: `${maxPosition}%`, transform: "translateY(-50%)" }}
					onMouseDown={(e) => { e.preventDefault(); setIsDraggingMax(true); }}
				>
					<div className="absolute -left-1 -top-1.5 w-8 h-4 flex items-center justify-center">
						<div className="w-2 h-2 bg-white rounded-full shadow-md border border-gray-300 group-hover:scale-125 transition-transform" />
					</div>
				</div>

				{/* Min handle (bottom) */}
				<div
					className="absolute left-0 w-full h-0.5 bg-white shadow-md cursor-ns-resize group z-10"
					style={{ top: `${minPosition}%`, transform: "translateY(-50%)" }}
					onMouseDown={(e) => { e.preventDefault(); setIsDraggingMin(true); }}
				>
					<div className="absolute -left-1 -top-1.5 w-8 h-4 flex items-center justify-center">
						<div className="w-2 h-2 bg-white rounded-full shadow-md border border-gray-300 group-hover:scale-125 transition-transform" />
					</div>
				</div>
			</div>
		</div>
	);
}
