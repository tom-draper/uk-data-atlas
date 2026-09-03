"use client";

import { useEffect, useRef } from "react";

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
	const isDraggingMinRef = useRef(false);
	const isDraggingMaxRef = useRef(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const currentMinRef = useRef(currentMin);
	const currentMaxRef = useRef(currentMax);
	const minRef = useRef(min);
	const maxRef = useRef(max);
	const onRangeInputRef = useRef(onRangeInput);
	const onRangeChangeEndRef = useRef(onRangeChangeEnd);

	useEffect(() => {
		currentMinRef.current = currentMin;
		currentMaxRef.current = currentMax;
		minRef.current = min;
		maxRef.current = max;
		onRangeInputRef.current = onRangeInput;
		onRangeChangeEndRef.current = onRangeChangeEnd;
	});

	const getValueFromPosition = (clientY: number) => {
		if (!containerRef.current) return currentMaxRef.current;
		const rect = containerRef.current.getBoundingClientRect();
		const relativeY = clientY - rect.top;
		const percentage = Math.max(0, Math.min(1, relativeY / rect.height));
		return maxRef.current - percentage * (maxRef.current - minRef.current);
	};

	const startDrag = (handle: "min" | "max") => {
		isDraggingMinRef.current = handle === "min";
		isDraggingMaxRef.current = handle === "max";

		const handleMouseMove = (e: MouseEvent) => {
			if (isDraggingMinRef.current) {
				const newMin = Math.min(
					getValueFromPosition(e.clientY),
					currentMaxRef.current -
						(maxRef.current - minRef.current) * 0.05,
				);
				onRangeInputRef.current(
					Math.max(newMin, minRef.current),
					currentMaxRef.current,
				);
			} else if (isDraggingMaxRef.current) {
				const newMax = Math.max(
					getValueFromPosition(e.clientY),
					currentMinRef.current +
						(maxRef.current - minRef.current) * 0.05,
				);
				onRangeInputRef.current(
					currentMinRef.current,
					Math.min(newMax, maxRef.current),
				);
			}
		};

		const handleMouseUp = () => {
			isDraggingMinRef.current = false;
			isDraggingMaxRef.current = false;
			onRangeChangeEndRef.current();
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	};

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
				<div
					className="absolute inset-0 rounded"
					style={{ background: gradient, opacity }}
				/>
				{/* Max handle (top) */}
				<div
					role="slider"
					aria-label="Maximum value"
					aria-valuemin={min}
					aria-valuemax={max}
					aria-valuenow={currentMax}
					tabIndex={0}
					className="absolute left-0 w-full h-0.5 bg-white shadow-md cursor-ns-resize group z-10"
					style={{
						top: `${maxPosition}%`,
						transform: "translateY(-50%)",
					}}
					onMouseDown={(e) => {
						e.preventDefault();
						startDrag("max");
					}}
				>
					<div className="absolute -left-1 -top-1.5 w-8 h-4 flex items-center justify-center">
						<div className="size-2 bg-white rounded-full shadow-md border border-gray-300 group-hover:scale-125 transition-transform" />
					</div>
				</div>

				{/* Min handle (bottom) */}
				<div
					role="slider"
					aria-label="Minimum value"
					aria-valuemin={min}
					aria-valuemax={max}
					aria-valuenow={currentMin}
					tabIndex={0}
					className="absolute left-0 w-full h-0.5 bg-white shadow-md cursor-ns-resize group z-10"
					style={{
						top: `${minPosition}%`,
						transform: "translateY(-50%)",
					}}
					onMouseDown={(e) => {
						e.preventDefault();
						startDrag("min");
					}}
				>
					<div className="absolute -left-1 -top-1.5 w-8 h-4 flex items-center justify-center">
						<div className="size-2 bg-white rounded-full shadow-md border border-gray-300 group-hover:scale-125 transition-transform" />
					</div>
				</div>
			</div>
		</div>
	);
}
