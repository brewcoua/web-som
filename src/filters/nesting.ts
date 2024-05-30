/*
 * This filter removes elements that are nested within other elements in the array.
 * We only keep the highest level elements.
 * @param elements The elements to filter
 * @returns The elements that are not nested within other elements
 */
export async function filterNestedElements(
  elements: HTMLElement[]
): Promise<HTMLElement[]> {
  const filteredElements = await Promise.all(
    elements.map(async (element) => {
      let parent = element.parentElement;
      while (parent !== null) {
        if (elements.includes(parent)) {
          return null;
        }
        parent = parent.parentElement;
      }
      return element;
    })
  );

  return filteredElements.filter(
    (element) => element !== null
  ) as HTMLElement[];
}
