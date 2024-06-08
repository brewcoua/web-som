import { SELECTORS } from "./constants";
import InteractiveElements from "./domain/InteractiveElements";
import { VisibilityFilter, NestingFilter } from "./filters";

export default class Loader {
  private readonly filters = {
    visibility: new VisibilityFilter(),
    nesting: new NestingFilter(),
  };

  async loadElements() {
    const selector = SELECTORS.join(",");

    let fixedElements = Array.from(
      document.querySelectorAll(selector)
    ) as HTMLElement[];

    // Let's also do a querySelectorAll inside all the shadow roots (for custom elements, e.g. reddit)
    const shadowRoots = this.shadowRoots();
    for (let i = 0; i < shadowRoots.length; i++) {
      fixedElements = fixedElements.concat(
        Array.from(shadowRoots[i].querySelectorAll(selector))
      );
    }

    let unknownElements: HTMLElement[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode() {
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const el = node as HTMLElement;
      if (
        !el.matches(selector) &&
        window.getComputedStyle(el).cursor === "pointer"
      ) {
        unknownElements.push(el);
      }
    }

    unknownElements = Array.from(unknownElements)
      .filter((element, index, self) => self.indexOf(element) === index)
      .filter(
        (element) =>
          !element.closest("svg") &&
          !fixedElements.some((el) => el.contains(element))
      );

    let interactive: InteractiveElements = {
      fixed: fixedElements,
      unknown: unknownElements,
    };

    console.groupCollapsed("Elements");
    console.log("Before filters", interactive);

    interactive = await this.filters.visibility.apply(interactive);
    console.log("After visibility filter", interactive);

    interactive = await this.filters.nesting.apply(interactive);
    console.log("After nesting filter", interactive);
    console.groupEnd();

    return interactive.fixed.concat(interactive.unknown);
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
