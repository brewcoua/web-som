/*
 * Utility
 */

/**
 * Check if element is below referenceElement
 * @param element The element to check
 * @param referenceElement The reference element to check against
 * @returns True if element is below referenceElement, false otherwise
 */
export function isAbove(
	element: HTMLElement,
	referenceElement: HTMLElement
): boolean {
	// Helper function to get the effective z-index value
	function getEffectiveZIndex(
		element: HTMLElement,
		other: HTMLElement
	): number {
		while (element) {
			const zIndex = window.getComputedStyle(element).zIndex;
			if (zIndex !== 'auto') {
				const zIndexValue = parseInt(zIndex, 10);

				// Do not count the z-index of a common parent
				if (element.contains(other)) {
					return 0;
				}

				return isNaN(zIndexValue) ? 0 : zIndexValue;
			}
			element = element.parentElement as HTMLElement;
		}
		return 0;
	}

	const elementZIndex = getEffectiveZIndex(element, referenceElement);
	const referenceElementZIndex = getEffectiveZIndex(referenceElement, element);

	const elementPosition = element.compareDocumentPosition(referenceElement);

	// Check if element is a child or a parent of referenceElement
	if (
		elementPosition & Node.DOCUMENT_POSITION_CONTAINS ||
		elementPosition & Node.DOCUMENT_POSITION_CONTAINED_BY
	) {
		return false;
	}

	// Compare z-index values
	if (elementZIndex !== referenceElementZIndex) {
		return elementZIndex < referenceElementZIndex;
	}

	// As a fallback, compare document order
	return !!(elementPosition & Node.DOCUMENT_POSITION_PRECEDING);
}

export function isVisible(element: HTMLElement): boolean {
	if (element.offsetWidth === 0 && element.offsetHeight === 0) {
		return false;
	}

	const rect = element.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) {
		return false;
	}

	const style = window.getComputedStyle(element);
	if (
		style.display === 'none' ||
		style.visibility === 'hidden' ||
		style.pointerEvents === 'none'
	) {
		return false;
	}

	let parent = element.parentElement;
	while (parent !== null) {
		const parentStyle = window.getComputedStyle(parent);
		if (
			parentStyle.display === 'none' ||
			parentStyle.visibility === 'hidden' ||
			parentStyle.pointerEvents === 'none'
		) {
			return false;
		}
		parent = parent.parentElement;
	}

	return true;
}
