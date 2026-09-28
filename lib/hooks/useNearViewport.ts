import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Whether any of a set of elements is inside, or within `margin` of, its
 * scroll container's visible area. Returns a ref callback that adds an element
 * to the set (and removes it on unmount) and the current answer.
 *
 * True while nothing is observed, so content renders fully before its first
 * observation, when it renders no element to observe, and wherever
 * IntersectionObserver is missing.
 */
export function useNearViewport(margin = "250px") {
	const [near, setNear] = useState(true);
	const observerRef = useRef<IntersectionObserver | null>(null);
	const intersecting = useRef(new Map<Element, boolean>());

	const update = useCallback(() => {
		const states = [...intersecting.current.values()];
		setNear(states.length === 0 || states.some(Boolean));
	}, []);

	const observe = useCallback(
		(element: Element) => {
			if (typeof IntersectionObserver === "undefined") return;
			// The margin only stretches the root's box, so observe against the
			// scrolling panel rather than the page, which would clip at its edge.
			observerRef.current ??= new IntersectionObserver(
				(entries) => {
					for (const entry of entries)
						intersecting.current.set(
							entry.target,
							entry.isIntersecting,
						);
					update();
				},
				{
					root: element.closest(".scroll-container"),
					rootMargin: `${margin} 0px`,
				},
			);
			const observer = observerRef.current;
			observer.observe(element);
			return () => {
				observer.unobserve(element);
				intersecting.current.delete(element);
				update();
			};
		},
		[margin, update],
	);

	useEffect(
		() => () => {
			observerRef.current?.disconnect();
			observerRef.current = null;
		},
		[],
	);

	return [observe, near] as const;
}
