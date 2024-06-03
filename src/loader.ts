import { SELECTORS } from "./constants";
import { VisibilityFilter, NestingFilter } from "./filters";

export default class Loader {
  private readonly filters = {
    visibility: new VisibilityFilter(),
    nesting: new NestingFilter(),
  };

  async loadElements() {
    const selector = SELECTORS.join(",");

    let preselectedElements = Array.from(document.querySelectorAll(selector));

    // Let's also do a querySelectorAll inside all the shadow roots (for custom elements, e.g. reddit)
    const shadowRoots = this.shadowRoots();
    for (let i = 0; i < shadowRoots.length; i++) {
      preselectedElements = preselectedElements.concat(
        Array.from(shadowRoots[i].querySelectorAll(selector))
      );
    }

    const allElements = document.querySelectorAll("*");

    let clickableElements: HTMLElement[] = [];
    for (let i = 0; i < allElements.length; i++) {
      if (
        // Make sure it does not match the selector too to avoid duplicates
        !allElements[i].matches(selector) &&
        window.getComputedStyle(allElements[i]).cursor === "pointer"
      ) {
        clickableElements.push(allElements[i] as HTMLElement);
      }
    }

    clickableElements = Array.from(clickableElements)
      .filter((element, index, self) => self.indexOf(element) === index)
      .filter(
        (element) =>
          !element.closest("svg") &&
          !preselectedElements.some((el) => el.contains(element))
      );

    const visiblePreselected = await this.filters.visibility.apply(
      preselectedElements as HTMLElement[]
    );

    const visibleClickable =
      await this.filters.visibility.apply(clickableElements);
    const nestedAll = await this.filters.nesting.apply(
      visibleClickable.concat(visiblePreselected)
    );

    return visiblePreselected
      .concat(nestedAll)
      .filter((element, index, self) => self.indexOf(element) === index);
  }

  shadowRoots() {
    const shadowRoots: ShadowRoot[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node && (node as Element).shadowRoot) {
        shadowRoots.push((node as Element).shadowRoot as ShadowRoot);
      }
    }

    return shadowRoots;
  }
}
