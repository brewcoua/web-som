/*
 * Utility
 */
export function isAbove(
  element: HTMLElement,
  referenceElement: HTMLElement
): boolean {
  const elementZIndex = window.getComputedStyle(element).zIndex;
  const referenceElementZIndex =
    window.getComputedStyle(referenceElement).zIndex;

  const elementPosition = element.compareDocumentPosition(referenceElement);

  // Check if element is a child of referenceElement
  if (elementPosition & Node.DOCUMENT_POSITION_CONTAINS) {
    return false;
  }

  // Check if referenceElement is a child of element
  if (elementPosition & Node.DOCUMENT_POSITION_CONTAINED_BY) {
    return true;
  }

  // Compare z-index if both are not 'auto'
  if (elementZIndex !== "auto" && referenceElementZIndex !== "auto") {
    return parseInt(elementZIndex) > parseInt(referenceElementZIndex);
  }

  // If one of them has z-index 'auto', we need to compare their DOM position
  if (elementZIndex === "auto" || referenceElementZIndex === "auto") {
    return !!(elementPosition & Node.DOCUMENT_POSITION_PRECEDING);
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
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.pointerEvents === "none"
  ) {
    return false;
  }

  let parent = element.parentElement;
  while (parent !== null) {
    const parentStyle = window.getComputedStyle(parent);
    if (
      parentStyle.display === "none" ||
      parentStyle.visibility === "hidden" ||
      parentStyle.pointerEvents === "none"
    ) {
      return false;
    }
    parent = parent.parentElement;
  }

  return true;
}
