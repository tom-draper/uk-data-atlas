import { useEffect, useState } from "react";

/**
 * Whether an element is inside, or within `margin` of, its scroll container's
 * visible area. Returns a ref callback to attach and the current answer.
 * Starts true, so content renders fully before the first observation and
 * wherever IntersectionObserver is missing.
 */
export function useNearViewport(margin = "250px") {
	const [element, setElement] = useState<Element | null>(null);
	const [near, setNear] = useState(true);

	useEffect(() => {
		if (!element || typeof IntersectionObserver === "undefined") return;
		// The margin only stretches the root's box, so observe against the
		// scrolling panel rather than the page, which would clip at its edge.
		const root = element.closest(".scroll-container");
		const observer = new IntersectionObserver(
			([entry]) => setNear(entry.isIntersecting),
			{ root, rootMargin: `${margin} 0px` },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [element, margin]);

	return [setElement, near] as const;
}
