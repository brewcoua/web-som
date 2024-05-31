/*
 * This filter removes elements that are nested within other elements in the array.
 * In the case that a parent element has multiple children in the array (branching from the same point, multiple elements after that point only count as one),
 * the parent element is removed while the children are kept.
 * This should be relatively recursive.
 * @param elements The elements to filter
 * @returns The elements that are not nested within other elements
 */
export function filterNestedElements(elements: HTMLElement[]): HTMLElement[] {
  // First of, we map out the parent-child relationships by layering the elements
  // HOWEVER, the relative distance in HTML should be kept.
  // Meaning, a child that is 2 elements away from the parent should NOT be in the same layer as the actual direct child.

  // First we will list all top-level elements (elements that have no known clickable parent)
  const topLevelElements: HTMLElement[] = [],
    nonTopLevelElements: HTMLElement[] = [];
  for (const element of elements) {
    if (
      !elements.some(
        (otherElement) =>
          otherElement !== element && otherElement.contains(element)
      )
    ) {
      topLevelElements.push(element);
    } else {
      nonTopLevelElements.push(element);
    }
  }

  return topLevelElements.flatMap((element) =>
    getSelfOrChildren(element, nonTopLevelElements)
  );
}

type Branch = {
  directChild?: HTMLElement;
  children: HTMLElement[];
};

function getSelfOrChildren(
  element: HTMLElement,
  elements: HTMLElement[]
): HTMLElement[] {
  const branches = getBranches(element, elements);

  if (branches.length <= 1) {
    return [element];
  }

  return branches.flatMap((branch) => {
    if (branch.directChild) {
      return getSelfOrChildren(branch.directChild, elements);
    }

    return filterNestedElements(branch.children);
  });
}

function getBranches(element: HTMLElement, elements: HTMLElement[]): Branch[] {
  // We'll basically map out the direct childrens of that element.
  const directChildren = element.querySelectorAll(":scope > *");

  // Then, go through all of them to find which clickable element they belong to.
  return Array.from(directChildren).map((directChild) => {
    // Now, find all clickable elements that are children of the direct child.
    const children = elements.filter(
      (child) => child !== directChild && directChild.contains(child)
    );

    const isDirectClickable = elements.includes(directChild as HTMLElement);

    // Add the direct child and the children to the branches.
    return {
      directChild: isDirectClickable ? (directChild as HTMLElement) : undefined,
      children: children as HTMLElement[],
    };
  });
}
