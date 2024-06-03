import { VISIBILITY_RATIO, ELEMENT_SAMPLING_RATE } from "../constants";
import { Filter } from "../domain/filter";

class VisibilityFilter extends Filter {
  async apply(elements: HTMLElement[]): Promise<HTMLElement[]> {
    const visibleElements = await Promise.all(
      elements.map(async (element) => {
        if (element.offsetWidth === 0 && element.offsetHeight === 0) {
          return null;
        }

        const style = window.getComputedStyle(element);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.pointerEvents === "none"
        ) {
          return null;
        }

        // Check if any of the element's parents are hidden
        let parent = element.parentElement;
        let passed = true;
        while (parent !== null) {
          const parentStyle = window.getComputedStyle(parent);
          if (
            parentStyle.display === "none" ||
            parentStyle.visibility === "hidden" ||
            parentStyle.pointerEvents === "none"
          ) {
            passed = false;
            break;
          }
          parent = parent.parentElement;
        }
        if (!passed) {
          return null;
        }

        // This checks if the element is in the viewport AND that is it visible more than VISIBILITY_RATIO (0.7)
        const isVisible = await this.isElementVisible(element);
        if (!isVisible) {
          return null;
        }

        return element;
      })
    );

    return visibleElements.filter(
      (element) => element !== null
    ) as HTMLElement[];
  }

  async isElementVisible(element: HTMLElement) {
    return new Promise((resolve) => {
      const observer = new IntersectionObserver(async (entries) => {
        const entry = entries[0];
        observer.disconnect();

        if (entry.intersectionRatio < VISIBILITY_RATIO) {
          resolve(false);
          return;
        }

        const rect = element.getBoundingClientRect();

        // If rect is way too small, ignore it
        if (rect.width <= 1 || rect.height <= 1) {
          resolve(false);
          return;
        }

        // If rect is covering more than 80% of the screen ignore it (we do not want to consider full screen ads)
        if (
          rect.width >= window.innerWidth * 0.8 ||
          rect.height >= window.innerHeight * 0.8
        ) {
          resolve(false);
          return;
        }

        // IntersectionObserver only checks intersection with the viewport, not with other elements
        // Thus, we need to calculate the visible area ratio relative to the intersecting elements
        const visibleAreaRatio = await this.getVisibilityRatio(element, rect);
        resolve(visibleAreaRatio >= VISIBILITY_RATIO);
      });
      observer.observe(element);
    });
  }

  async getVisibilityRatio(element: HTMLElement, rect: DOMRect) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!ctx) {
      throw new Error("Could not get 2D context");
    }

    const elementZIndex = parseInt(
      window.getComputedStyle(element).zIndex || "0",
      10
    );

    // Ensure the canvas size matches the element's size
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // The whole canvas may not be visibile => we need to check the visible area for the viewport
    const visibleRect = {
      top: Math.max(0, rect.top),
      left: Math.max(0, rect.left),
      bottom: Math.min(window.innerHeight, rect.bottom),
      right: Math.min(window.innerWidth, rect.right),
      width: rect.width,
      height: rect.height,
    };
    visibleRect.width = visibleRect.right - visibleRect.left;
    visibleRect.height = visibleRect.bottom - visibleRect.top;

    // Draw the element on the canvas
    this.drawElement(element, ctx, rect, rect, "white");

    // Count pixels that are visible after drawing the element
    const totalPixels = this.countVisiblePixels(ctx, {
      top: visibleRect.top - rect.top,
      left: visibleRect.left - rect.left,
      width: canvas.width,
      height: canvas.height,
    });

    // Find all elements that can possibly intersect with the element
    // For this, we make a simple grid of points following ELEMENT_SAMPLING_RATE and check at each of those points
    // Hence, we end up with (1 / ELEMENT_SAMPLING_RATE) ^ 2 points (or less if the element is too small)
    const foundElements = await Promise.all(
      Array.from({ length: Math.ceil(1 / ELEMENT_SAMPLING_RATE) }).map(
        async (_, i) => {
          return Promise.all(
            Array.from({ length: Math.ceil(1 / ELEMENT_SAMPLING_RATE) }).map(
              async (_, j) => {
                const elements = document.elementsFromPoint(
                  rect.left + rect.width * ELEMENT_SAMPLING_RATE * i,
                  rect.top + rect.height * ELEMENT_SAMPLING_RATE * j
                );

                // Make sure the current element is included (point may miss if the element is not rectangular)
                if (!elements.includes(element)) {
                  return [];
                }

                const currentIndex = elements.indexOf(element);

                return elements.slice(0, currentIndex);
              }
            )
          );
        }
      )
    );

    // We remove duplicates and flatten the array
    const uniqueElements = Array.from(
      new Set(foundElements.flat(2).filter((el) => el !== element))
    );

    // We also remove all elements that have a lower zIndex, or are parents (that have lower/no zIndex)
    let elements: Element[] = [];
    for (const el of uniqueElements) {
      const elZIndex = parseInt(window.getComputedStyle(el).zIndex || "0", 10);
      if (elZIndex < elementZIndex) {
        continue;
      }

      if (el.contains(element) || element.contains(el)) {
        continue;
      }

      elements.push(el);
    }

    // After that, remove anything that is a children of any other non-filtered element
    elements = elements.filter((el) => {
      for (const other of elements) {
        if (el !== other && other.contains(el)) {
          return false;
        }
      }
      return true;
    });

    // Then, we draw all the intersecting elements on our canvas
    await Promise.all(
      elements.map(async (el) => {
        const elRect = el.getBoundingClientRect();

        // Try drawing it on the canvas
        this.drawElement(el, ctx, elRect, rect, "black");
      })
    );

    // Finally, calculate the visible pixels after drawing all the elements
    const visiblePixels = this.countVisiblePixels(ctx, {
      top: visibleRect.top - rect.top,
      left: visibleRect.left - rect.left,
      width: visibleRect.width,
      height: visibleRect.height,
    });

    canvas.remove();

    // Prevent NaN
    if (totalPixels === 0) {
      return 0;
    }

    return visiblePixels / totalPixels;
  }

  countVisiblePixels(
    ctx: CanvasRenderingContext2D,
    rect: {
      top: number;
      left: number;
      width: number;
      height: number;
    }
  ) {
    const data = ctx.getImageData(
      rect.left,
      rect.top,
      rect.width,
      rect.height
    ).data;

    let visiblePixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 0) {
        // Just check R channel
        visiblePixels++;
      }
    }
    return visiblePixels;
  }

  drawElement(
    element: Element,
    ctx: CanvasRenderingContext2D,
    rect: DOMRect,
    baseRect: DOMRect,
    color = "black"
  ) {
    const styles = window.getComputedStyle(element);

    const radius = styles.borderRadius?.split(" ").map((r) => parseFloat(r));
    const clipPath = styles.clipPath;

    const offsetRect = {
      top: rect.top - baseRect.top,
      bottom: rect.bottom - baseRect.top,
      left: rect.left - baseRect.left,
      right: rect.right - baseRect.left,
      width: rect.width,
      height: rect.height,
    };
    offsetRect.width = offsetRect.right - offsetRect.left;
    offsetRect.height = offsetRect.bottom - offsetRect.top;

    ctx.fillStyle = color;

    if (clipPath && clipPath !== "none") {
      const clips = clipPath.split(/,| /);

      clips.forEach((clip) => {
        const kind = clip.trim().match(/^([a-z]+)\((.*)\)$/);
        if (!kind) {
          return;
        }

        switch (kind[0]) {
          case "polygon":
            const path = this.pathFromPolygon(clip, rect);
            ctx.fill(path);
            break;
          default:
            console.log("Unknown clip path kind: " + kind);
        }
      });
    } else if (radius) {
      const path = new Path2D();

      if (radius.length === 1) radius[1] = radius[0];
      if (radius.length === 2) radius[2] = radius[0];
      if (radius.length === 3) radius[3] = radius[1];

      // Go to the top left corner
      path.moveTo(offsetRect.left + radius[0], offsetRect.top);

      path.arcTo(
        // Arc to the top right corner
        offsetRect.right,
        offsetRect.top,
        offsetRect.right,
        offsetRect.bottom,
        radius[1]
      );

      path.arcTo(
        offsetRect.right,
        offsetRect.bottom,
        offsetRect.left,
        offsetRect.bottom,
        radius[2]
      );

      path.arcTo(
        offsetRect.left,
        offsetRect.bottom,
        offsetRect.left,
        offsetRect.top,
        radius[3]
      );

      path.arcTo(
        offsetRect.left,
        offsetRect.top,
        offsetRect.right,
        offsetRect.top,
        radius[0]
      );
      path.closePath();

      ctx.fill(path);
    } else {
      ctx.fillRect(
        offsetRect.left,
        offsetRect.top,
        offsetRect.width,
        offsetRect.height
      );
    }
  }

  pathFromPolygon(polygon: string, rect: DOMRect) {
    if (!polygon || !polygon.match(/^polygon\((.*)\)$/)) {
      throw new Error("Invalid polygon format: " + polygon);
    }

    const path = new Path2D();
    const points = polygon.match(/\d+(\.\d+)?%/g);

    if (points && points.length >= 2) {
      const startX = parseFloat(points[0]);
      const startY = parseFloat(points[1]);
      path.moveTo((startX * rect.width) / 100, (startY * rect.height) / 100);

      for (let i = 2; i < points.length; i += 2) {
        const x = parseFloat(points[i]);
        const y = parseFloat(points[i + 1]);
        path.lineTo((x * rect.width) / 100, (y * rect.height) / 100);
      }

      path.closePath();
    }

    return path;
  }
}

export default VisibilityFilter;
