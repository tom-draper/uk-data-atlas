/** A binary min-heap of [key, value] entries, smallest key first. */
export class MinHeap {
	private readonly entries: [number, number][] = [];

	get size() {
		return this.entries.length;
	}

	push(entry: [number, number]) {
		const heap = this.entries;
		heap.push(entry);
		let child = heap.length - 1;
		while (child > 0) {
			const parent = (child - 1) >> 1;
			if (heap[parent]![0] <= heap[child]![0]) break;
			[heap[parent], heap[child]] = [heap[child]!, heap[parent]!];
			child = parent;
		}
	}

	/** Removes and returns the smallest entry. The heap must not be empty. */
	pop(): [number, number] {
		const heap = this.entries;
		const top = heap[0]!;
		const last = heap.pop()!;
		if (heap.length === 0) return top;
		heap[0] = last;
		let parent = 0;
		for (;;) {
			const left = parent * 2 + 1;
			if (left >= heap.length) break;
			const right = left + 1;
			const child =
				right < heap.length && heap[right]![0] < heap[left]![0]
					? right
					: left;
			if (heap[parent]![0] <= heap[child]![0]) break;
			[heap[parent], heap[child]] = [heap[child]!, heap[parent]!];
			parent = child;
		}
		return top;
	}
}
