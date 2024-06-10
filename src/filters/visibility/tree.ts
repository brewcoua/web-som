import { DISJOINT_THRESHOLD, VISIBILITY_RATIO } from '@/constants';
import RBush from 'rbush';

/**
 * A class for mapping out the DOM tree and efficiently querying all intersecting elements for a given rectangle.
 */
export default class DOMTree {
	private tree: RBush<RectangleData> = new RBush();
	constructor(private readonly bounds: Rectangle) {}

	/**
	 * Inserts a new rectangle into the tree.
	 */
	insert(rect: Rectangle): void {
		// If the rectangle is outside of the bounds, ignore it
		if (!this.bounds.containsThreshold(rect, VISIBILITY_RATIO)) {
			return;
		}

		this.tree.insert(rect.data);
	}

	/**
	 * Inserts a list of rectangles into the tree.
	 */
	insertAll(rects: Rectangle[]): void {
		const data = rects
			.filter((rect) => this.bounds.containsThreshold(rect, VISIBILITY_RATIO))
			.map((rect) => rect.data);

		this.tree.load(data);
	}

	/**
	 * Returns all rectangles that intersect with the given rectangle.
	 */
	query(rect: Rectangle): HTMLElement[] {
		const foundRects = this.tree.search(rect.data);
		return foundRects.flatMap((foundRect) => foundRect.elements);
	}
}

export type RectangleData = {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	elements: HTMLElement[];
};

export class Rectangle {
	x: number;
	y: number;
	width: number;
	height: number;
	elements: HTMLElement[];

	constructor(
		x: number,
		y: number,
		width: number,
		height: number,
		elements: HTMLElement[] = []
	) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.elements = elements;
	}

	get area(): number {
		return this.width * this.height;
	}

	get data(): RectangleData {
		return {
			minX: this.x,
			minY: this.y,
			maxX: this.x + this.width,
			maxY: this.y + this.height,
			elements: this.elements,
		};
	}

	disjoint(rect: Rectangle): boolean {
		// Using DISJOINT_THRESHOLD, if the different in size and position is less than DISJOINT_THRESHOLD, the elements are joined
		return (
			Math.abs(this.x - rect.x) > DISJOINT_THRESHOLD * this.x ||
			Math.abs(this.y - rect.y) > DISJOINT_THRESHOLD * this.y ||
			Math.abs(this.width - rect.width) > DISJOINT_THRESHOLD * this.width ||
			Math.abs(this.height - rect.height) > DISJOINT_THRESHOLD * this.height
		);
	}

	join(rect: Rectangle): Rectangle {
		const x = Math.min(this.x, rect.x);
		const y = Math.min(this.y, rect.y);
		const width = Math.max(this.x + this.width, rect.x + rect.width) - x;
		const height = Math.max(this.y + this.height, rect.y + rect.height) - y;

		return new Rectangle(x, y, width, height, [
			...this.elements,
			...rect.elements,
		]);
	}

	contains(rect: Rectangle): boolean {
		return (
			rect.x >= this.x &&
			rect.x + rect.width <= this.x + this.width &&
			rect.y >= this.y &&
			rect.y + rect.height <= this.y + this.height
		);
	}

	containsThreshold(rect: Rectangle, threshold: number): boolean {
		// Contain at least (threshold * 100)% of the rectangle
		const x1 = Math.max(this.x, rect.x);
		const y1 = Math.max(this.y, rect.y);
		const x2 = Math.min(this.x + this.width, rect.x + rect.width);
		const y2 = Math.min(this.y + this.height, rect.y + rect.height);

		const intersection = (x2 - x1) * (y2 - y1);
		const area = rect.width * rect.height;

		return intersection >= area * threshold;
	}

	intersects(rect: Rectangle): boolean {
		return !(
			rect.x > this.x + this.width ||
			rect.x + rect.width < this.x ||
			rect.y > this.y + this.height ||
			rect.y + rect.height < this.y
		);
	}
}
