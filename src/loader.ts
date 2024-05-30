import { SELECTORS } from "./constants";
import { filterNestedElements, filterVisibleElements } from "./filters";

/*
 * This function loads all elements that are clickable and visible on the page.
 * @returns The elements that are clickable and visible
 */
export async function loadElements() {
  const preselectedElements = document.querySelectorAll(SELECTORS.join(","));
  const allElements = document.querySelectorAll("*");

  const clickableElements: HTMLElement[] = [];
  for (let i = 0; i < allElements.length; i++) {
    if (window.getComputedStyle(allElements[i]).cursor === "pointer") {
      clickableElements.push(allElements[i] as HTMLElement);
    }
  }

  const fullElements = Array.from(preselectedElements)
    .concat(clickableElements)
    .filter(
      (element, index, self) => self.indexOf(element) === index
    ) as HTMLElement[];

  const elements = await filterVisibleElements(fullElements);
  return await filterNestedElements(elements);
}
