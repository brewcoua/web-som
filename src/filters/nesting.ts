import Filter from "@/domain/Filter";
import InteractiveElements from "@/domain/InteractiveElements";

// Threshold to be considered disjoint from the top-level element
const SIZE_THRESHOLD = 0.9;
// Threshold to remove top-level elements with too many children
const QUANTITY_THRESHOLD = 3;
// Elements to prioritize (as in to to avoid keeping any children from these elements)
const PRIORITY_SELECTOR = ["a", "button", "input", "select", "textarea"];

class NestingFilter extends Filter {
  async apply(elements: InteractiveElements): Promise<InteractiveElements> {
    // Basically, what we want to do it is compare the size of the top-level elements with the size of their children.
    // For that, we make branches and compare with the first children of each of these branches.
    // If there are other children beyond that, we'll recursively call this function on them.

    const fullElements = elements.fixed.concat(elements.unknown);
    const { top, others } = this.getTopLevelElements(fullElements);

    const results = await Promise.all(
      top.map(async (topElement) =>
        this.compareTopWithChildren(topElement, others)
      )
    );

    return {
      fixed: elements.fixed,
      unknown: results.flat().filter((el) => elements.fixed.indexOf(el) === -1),
    };
  }

  async compareTopWithChildren(
    top: HTMLElement,
    children: HTMLElement[]
  ): Promise<HTMLElement[]> {
    if (PRIORITY_SELECTOR.some((selector) => top.matches(selector))) {
      return [top];
    }

    const branches = this.getBranches(top, children);
    const rect = top.getBoundingClientRect();

    if (branches.length <= 1) {
      return [top];
    }

    const results = await Promise.all(
      branches.map(async (branch: Branch) => {
        // Let's compare the size of the top-level element with the size of the first hit
        const firstHitRect = branch.top.getBoundingClientRect();

        // If the difference in size is too big, we'll consider them disjoint.
        // If that's the case, then we recursively call this function on the children.
        if (
          firstHitRect.width / rect.width < SIZE_THRESHOLD &&
          firstHitRect.height / rect.height < SIZE_THRESHOLD
        ) {
          return [];
        }

        if (branch.children.length === 0) {
          return [branch.top];
        }

        return this.compareTopWithChildren(branch.top, branch.children);
      })
    );

    const total = results.flat();

    if (total.length > QUANTITY_THRESHOLD) {
      return total;
    }

    return [top, ...total];
  }

  getBranches(element: HTMLElement, elements: HTMLElement[]): Branch[] {
    const firstHits = this.getFirstHitChildren(element, elements);

    return firstHits.map((firstHit) => {
      const children = elements.filter(
        (child) => !firstHits.includes(child) && firstHit.contains(child)
      );

      return { top: firstHit, children };
    });
  }

  getFirstHitChildren(
    element: HTMLElement,
    elements: HTMLElement[]
  ): HTMLElement[] {
    // We'll basically map out the direct childrens of that element.
    // We'll continue doing this recursively until we get a hit.
    // If there's more than one hit, just make a list of them.
    const directChildren = element.querySelectorAll(":scope > *");

    const clickableDirectChildren = Array.from(directChildren).filter((child) =>
      elements.includes(child as HTMLElement)
    ) as HTMLElement[];

    if (clickableDirectChildren.length > 0) {
      return clickableDirectChildren;
    }

    return Array.from(directChildren).flatMap((child) =>
      this.getFirstHitChildren(child as HTMLElement, elements)
    );
  }

  getTopLevelElements(elements: HTMLElement[]): {
    top: HTMLElement[];
    others: HTMLElement[];
  } {
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

    return { top: topLevelElements, others: nonTopLevelElements };
  }
}

export default NestingFilter;

type Branch = {
  top: HTMLElement; // First hit element
  children: HTMLElement[];
};
