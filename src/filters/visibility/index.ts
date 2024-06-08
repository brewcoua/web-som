import {
  VISIBILITY_RATIO,
  ELEMENT_BATCH_SIZE,
  MAX_COVER_RATIO,
} from "@/constants";
import Filter from "@/domain/Filter";
import InteractiveElements from "@/domain/InteractiveElements";

import QuadTree, { Rectangle } from "./quad";
import { isVisible } from "./utils";
import VisibilityCanvas from "./canvas";

class VisibilityFilter extends Filter {
  private qt!: QuadTree;

  async apply(elements: InteractiveElements): Promise<InteractiveElements> {
    this.qt = this.mapQuadTree();

    const results = await Promise.all([
      this.applyScoped(elements.fixed),
      this.applyScoped(elements.unknown),
    ]);

    return {
      fixed: results[0],
      unknown: results[1],
    };
  }

  async applyScoped(elements: HTMLElement[]): Promise<HTMLElement[]> {
    const results = await Promise.all(
      Array.from({
        length: Math.ceil(elements.length / ELEMENT_BATCH_SIZE),
      }).map(async (_, i) => {
        const batch = elements
          .slice(i * ELEMENT_BATCH_SIZE, (i + 1) * ELEMENT_BATCH_SIZE)
          .filter((el) => isVisible(el));

        // Now, let's process the batch
        const visibleElements: HTMLElement[] = [];
        for (const element of batch) {
          const isVisible = await this.isDeepVisible(element);
          if (isVisible) {
            visibleElements.push(element);
          }
        }

        return visibleElements;
      })
    );

    return results.flat();
  }

  mapQuadTree(): QuadTree {
    const boundary = new Rectangle(0, 0, window.innerWidth, window.innerHeight);
    const qt = new QuadTree(boundary, 4);

    // use a tree walker and also filter out invisible elements
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const element = node as HTMLElement;
          if (isVisible(element)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        },
      }
    );

    let currentNode: Node | null = walker.currentNode;
    while (currentNode) {
      const element = currentNode as HTMLElement;
      const rect = element.getBoundingClientRect();
      qt.insert(
        new Rectangle(rect.left, rect.top, rect.width, rect.height, element)
      );
      currentNode = walker.nextNode();
    }

    return qt;
  }

  async isDeepVisible(element: HTMLElement) {
    return new Promise((resolve) => {
      const observer = new IntersectionObserver(async (entries) => {
        const entry = entries[0];
        observer.disconnect();

        if (entry.intersectionRatio < VISIBILITY_RATIO) {
          resolve(false);
          return;
        }

        const rect = element.getBoundingClientRect();
        // If rect is covering more than size * MAX_COVER_RATIO of the screen ignore it (we do not want to consider full screen ads)
        if (
          rect.width >= window.innerWidth * MAX_COVER_RATIO ||
          rect.height >= window.innerHeight * MAX_COVER_RATIO
        ) {
          resolve(false);
          return;
        }

        // IntersectionObserver only checks intersection with the viewport, not with other elements
        // Thus, we need to calculate the visible area ratio relative to the intersecting elements
        const canvas = new VisibilityCanvas(element);
        const visibleAreaRatio = await canvas.eval(this.qt);
        resolve(visibleAreaRatio >= VISIBILITY_RATIO);
      });
      observer.observe(element);
    });
  }
}

export default VisibilityFilter;
