import QuadTree, { Rectangle } from './tree';
import { isAbove, isVisible } from './utils';

export default class VisibilityCanvas {
	private readonly canvas: OffscreenCanvas;
	private readonly ctx: OffscreenCanvasRenderingContext2D;

	private readonly rect: AbstractRect;
	private readonly visibleRect: AbstractRect;

	constructor(private readonly element: HTMLElement) {
		this.element = element;
		this.rect = this.element.getBoundingClientRect();
		this.canvas = new OffscreenCanvas(this.rect.width, this.rect.height);
		this.ctx = this.canvas.getContext('2d', {
			willReadFrequently: true,
		})!;
		this.ctx.imageSmoothingEnabled = false;

		this.visibleRect = {
			top: Math.max(0, this.rect.top),
			left: Math.max(0, this.rect.left),
			bottom: Math.min(window.innerHeight, this.rect.bottom),
			right: Math.min(window.innerWidth, this.rect.right),
			width: this.rect.width,
			height: this.rect.height,
		};
		this.visibleRect.width = this.visibleRect.right - this.visibleRect.left;
		this.visibleRect.height = this.visibleRect.bottom - this.visibleRect.top;
	}

	async eval(qt: QuadTree): Promise<number> {
		this.ctx.fillStyle = 'black';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		this.drawElement(this.element, 'white');

		const canvasVisRect: AbstractRect = {
			top: this.visibleRect.top - this.rect.top,
			bottom: this.visibleRect.bottom - this.rect.top,
			left: this.visibleRect.left - this.rect.left,
			right: this.visibleRect.right - this.rect.left,
			width: this.canvas.width,
			height: this.canvas.height,
		};

		const totalPixels = await this.countVisiblePixels(canvasVisRect);
		if (totalPixels === 0) return 0;

		const elements = this.getIntersectingElements(qt);
		for (const el of elements) {
			this.drawElement(el, 'black');
		}

		const visiblePixels = await this.countVisiblePixels(canvasVisRect);
		return visiblePixels / totalPixels;
	}

	private getIntersectingElements(qt: QuadTree): HTMLElement[] {
		const range = new Rectangle(
			this.rect.left,
			this.rect.right,
			this.rect.width,
			this.rect.height,
			[this.element]
		);
		const candidates = qt.query(range);

		// Now, for the sake of avoiding completely hidden elements, we do one elementsOnPoint check
		const elementsFromPoint = document.elementsFromPoint(
			this.rect.left + this.rect.width / 2,
			this.rect.top + this.rect.height / 2
		) as HTMLElement[];

		return candidates
			.concat(elementsFromPoint)
			.filter(
				(el, i, arr) =>
					arr.indexOf(el) === i && isVisible(el) && isAbove(this.element, el)
			);
	}

	private async countVisiblePixels(visibleRect: AbstractRect): Promise<number> {
		const imageData = this.ctx.getImageData(
			visibleRect.left,
			visibleRect.top,
			visibleRect.width,
			visibleRect.height
		);

		let visiblePixels = 0;
		for (let i = 0; i < imageData.data.length; i += 4) {
			const isWhite = imageData.data[i + 1] === 255;

			if (isWhite) {
				visiblePixels++;
			}
		}

		return visiblePixels;
	}

	private drawElement(element: Element, color = 'black') {
		const rect = element.getBoundingClientRect();
		const styles = window.getComputedStyle(element);

		const radius = styles.borderRadius?.split(' ').map((r) => parseFloat(r));
		const clipPath = styles.clipPath;

		const offsetRect = {
			top: rect.top - this.rect.top,
			bottom: rect.bottom - this.rect.top,
			left: rect.left - this.rect.left,
			right: rect.right - this.rect.left,
			width: rect.width,
			height: rect.height,
		};
		offsetRect.width = offsetRect.right - offsetRect.left;
		offsetRect.height = offsetRect.bottom - offsetRect.top;

		this.ctx.fillStyle = color;

		if (clipPath && clipPath !== 'none') {
			const clips = clipPath.split(/,| /);

			clips.forEach((clip) => {
				const kind = clip.trim().match(/^([a-z]+)\((.*)\)$/);
				if (!kind) {
					return;
				}

				switch (kind[0]) {
					case 'polygon':
						const path = this.pathFromPolygon(clip, rect);
						this.ctx.fill(path);
						break;
					default:
						console.log('Unknown clip path kind: ' + kind);
				}
			});
		} else if (radius) {
			const path = new Path2D();

			if (radius.length === 1) radius[1] = radius[0];
			if (radius.length === 2) radius[2] = radius[0];
			if (radius.length === 3) radius[3] = radius[1];

			// Go to the top left corner
			path.moveTo(offsetRect.left + radius[0], offsetRect.top);

			path.arcTo(
				// Arc to the top right corner
				offsetRect.right,
				offsetRect.top,
				offsetRect.right,
				offsetRect.bottom,
				radius[1]
			);

			path.arcTo(
				offsetRect.right,
				offsetRect.bottom,
				offsetRect.left,
				offsetRect.bottom,
				radius[2]
			);

			path.arcTo(
				offsetRect.left,
				offsetRect.bottom,
				offsetRect.left,
				offsetRect.top,
				radius[3]
			);

			path.arcTo(
				offsetRect.left,
				offsetRect.top,
				offsetRect.right,
				offsetRect.top,
				radius[0]
			);
			path.closePath();

			this.ctx.fill(path);
		} else {
			this.ctx.fillRect(
				offsetRect.left,
				offsetRect.top,
				offsetRect.width,
				offsetRect.height
			);
		}
	}

	private pathFromPolygon(polygon: string, rect: AbstractRect) {
		if (!polygon || !polygon.match(/^polygon\((.*)\)$/)) {
			throw new Error('Invalid polygon format: ' + polygon);
		}

		const path = new Path2D();
		const points = polygon.match(/\d+(\.\d+)?%/g);

		if (points && points.length >= 2) {
			const startX = parseFloat(points[0]);
			const startY = parseFloat(points[1]);
			path.moveTo((startX * rect.width) / 100, (startY * rect.height) / 100);

			for (let i = 2; i < points.length; i += 2) {
				const x = parseFloat(points[i]);
				const y = parseFloat(points[i + 1]);
				path.lineTo((x * rect.width) / 100, (y * rect.height) / 100);
			}

			path.closePath();
		}

		return path;
	}
}

type AbstractRect = {
	top: number;
	left: number;
	bottom: number;
	right: number;
	width: number;
	height: number;
};
