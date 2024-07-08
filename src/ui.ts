import { EDITABLE_SELECTORS, SURROUNDING_RADIUS } from './constants';
import UIColors, { Color } from './ui/colors';

type SimpleDOMRect = {
	top: number;
	bottom: number;
	left: number;
	right: number;
	width: number;
	height: number;
};

export default class UI {
	private readonly colors = new UIColors();

	display(elements: HTMLElement[]) {
		let wrapper = document.querySelector('som-wrapper');
		if (!wrapper) {
			wrapper = document.createElement('som-wrapper');
			document.body.appendChild(wrapper);
		}

		const labels: SimpleDOMRect[] = [];
		const boundingBoxes: (SimpleDOMRect & {
			color: Color;
		})[] = [];
		const rawBoxes: HTMLElement[] = [];

		// First, define the bounding boxes
		for (let i = 0; i < elements.length; i++) {
			const element = elements[i];

			const rect = element.getBoundingClientRect();
			const box = document.createElement('som-box');
			box.style.left = `${rect.left}px`;
			box.style.top = `${rect.top}px`;
			box.style.width = `${rect.width}px`;
			box.style.height = `${rect.height}px`;
			box.classList.add('SoM');

			// If the element is editable, add additional class
			if (
				element.isContentEditable ||
				EDITABLE_SELECTORS.some((selector) =>
					element.matches(selector as string)
				)
			) {
				box.classList.add('editable');
			}

			// To generate a color, we'll need to first get the colors of the surrounding boxes
			const surroundingColors = boundingBoxes
				.filter((box) => {
					// Check if it is within SURROUNDING_RADIUS, from any of its corners
					const distances = [
						Math.sqrt(
							Math.pow(rect.left - box.left, 2) +
								Math.pow(rect.top - box.top, 2)
						),
						Math.sqrt(
							Math.pow(rect.right - box.right, 2) +
								Math.pow(rect.top - box.top, 2)
						),
						Math.sqrt(
							Math.pow(rect.left - box.left, 2) +
								Math.pow(rect.bottom - box.bottom, 2)
						),
						Math.sqrt(
							Math.pow(rect.right - box.right, 2) +
								Math.pow(rect.bottom - box.bottom, 2)
						),
					];

					return distances.some((distance) => distance < SURROUNDING_RADIUS);
				})
				.map((box) => box.color);

			const color = this.colors.contrastColor(element, surroundingColors);

			// Set color as variable to be used in CSS
			box.style.setProperty(
				'--SoM-color',
				`${color.r}, ${color.g}, ${color.b}`
			);

			wrapper.appendChild(box);

			boundingBoxes.push({
				top: rect.top,
				bottom: rect.bottom,
				left: rect.left,
				right: rect.right,
				width: rect.width,
				height: rect.height,
				color: color,
			});

			rawBoxes.push(box);
		}

		for (let i = 0; i < elements.length; i++) {
			const element = elements[i];
			const box = boundingBoxes[i];

			const label = document.createElement('som-label');
			label.textContent = `${i}`;
			label.style.color = this.getColorByLuminance(box.color);
			label.classList.add('SoM--label');

			rawBoxes[i].appendChild(label);

			const labelRect = label.getBoundingClientRect();

			const gridSize = 10;
			const positions: {
				top: number;
				left: number;
			}[] = [];
			for (let i = 0; i <= gridSize; i++) {
				// Top side
				positions.push({
					top: box.top - labelRect.height,
					left: box.left + (box.width / gridSize) * i - labelRect.width / 2,
				});
				// Bottom side
				positions.push({
					top: box.bottom,
					left: box.left + (box.width / gridSize) * i - labelRect.width / 2,
				});
				// Left side
				positions.push({
					top: box.top + (box.height / gridSize) * i - labelRect.height / 2,
					left: box.left - labelRect.width,
				});
				// Right side
				positions.push({
					top: box.top + (box.height / gridSize) * i - labelRect.height / 2,
					left: box.right,
				});
			}

			// Calculate score for each position
			const scores = positions.map((position) => {
				let score = 0;

				// Check if position is within bounds
				if (
					position.top < 0 ||
					position.top + labelRect.height > window.innerHeight ||
					position.left < 0 ||
					position.left + labelRect.width > window.innerWidth
				) {
					score += Infinity; // Out of bounds, set score to infinity
				} else {
					// Calculate overlap with other labels and bounding boxes
					labels.concat(boundingBoxes).forEach((existing) => {
						// Ignore bounding boxes that are fully covering the current box
						if (
							existing.top <= box.top &&
							existing.bottom >= box.bottom &&
							existing.left <= box.left &&
							existing.right >= box.right
						) {
							return;
						}

						const overlapWidth = Math.max(
							0,
							Math.min(
								position.left + labelRect.width,
								existing.left + existing.width
							) - Math.max(position.left, existing.left)
						);
						const overlapHeight = Math.max(
							0,
							Math.min(
								position.top + labelRect.height,
								existing.top + existing.height
							) - Math.max(position.top, existing.top)
						);
						score += overlapWidth * overlapHeight; // Add overlap area to score
					});
				}

				return score;
			});

			// Select position with lowest score
			const bestPosition = positions[scores.indexOf(Math.min(...scores))];

			// Set label position
			label.style.top = `${bestPosition.top - box.top}px`;
			label.style.left = `${bestPosition.left - box.left}px`;

			// Add the new label's position to the array
			labels.push({
				top: bestPosition.top,
				left: bestPosition.left,
				right: bestPosition.left + labelRect.width,
				bottom: bestPosition.top + labelRect.height,
				width: labelRect.width,
				height: labelRect.height,
			});

			element.setAttribute('data-SoM', `${i}`);
		}
	}

	getColorByLuminance(color: Color) {
		return color.luminance() > 0.5 ? 'black' : 'white';
	}
}
