import { VISIBILITY_RATIO, ELEMENT_SAMPLING_RATE } from "../constants";

/*
 * Filter out all elements that are not visible on the screen
 * This includes elements that are not displayed, have a display of none, are hidden, or are not in the viewport
 * @param elements The elements to filter
 * @returns The elements that are visible on the screen
 */
export async function filterVisibleElements(
  elements: HTMLElement[]
): Promise<HTMLElement[]> {
  const visibleElements = await Promise.all(
    elements.map(async (element) => {
      if (element.offsetWidth === 0 && element.offsetHeight === 0) {
        return null;
      }

      const isDebug = element.id === "company-name";

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

      // Check if the element is in the viewport
      const rect = element.getBoundingClientRect();
      if (
        rect.top >= window.innerHeight ||
        rect.bottom <= 0 ||
        rect.left >= window.innerWidth ||
        rect.right <= 0
      ) {
        return null;
      }

      const isVisible = await isElementVisible(element);
      if (!isVisible) {
        return null;
      }

      return element;
    })
  );

  return visibleElements.filter((element) => element !== null) as HTMLElement[];
}

/*
 * Check if an element is visible on the screen by using IntersectionObserver and further calculating the visibility ratio
 * relative to the intersecting elements.
 * @param element The element to check
 */
async function isElementVisible(element: HTMLElement) {
  // Use IntersectionObserver to check if the element is visible
  return new Promise((resolve) => {
    const observer = new IntersectionObserver(async (entries) => {
      const entry = entries[0];
      observer.disconnect();

      if (entry.intersectionRatio < VISIBILITY_RATIO) {
        resolve(false);
        return;
      }

      const rect = element.getBoundingClientRect();

      // If rect is either way too small, ignore it
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

      const visibleAreaRatio = await calculateVisibleAreaRatio(element, rect);

      resolve(visibleAreaRatio >= VISIBILITY_RATIO);
    });
    observer.observe(element);
  });
}

/*
 * Calculates the visible area ratio of an element on the screen
 * @param element The element to calculate the visible area ratio for
 * @param rect The bounding rect of the element
 * @returns The visible area ratio of the element (between 0 and 1)
 */
async function calculateVisibleAreaRatio(element: HTMLElement, rect: DOMRect) {
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

  // The whole canvas may not be visible => we need to check the visible area for the viewport
  const visiblePos = {
    top: Math.max(0, rect.top),
    left: Math.max(0, rect.left),
    bottom: Math.min(window.innerHeight, rect.bottom),
    right: Math.min(window.innerWidth, rect.right),
  };
  const visibleSize = {
    width: visiblePos.right - visiblePos.left,
    height: visiblePos.bottom - visiblePos.top,
  };

  const countVisiblePixels = () => {
    const data = ctx.getImageData(
      visiblePos.left - rect.left,
      visiblePos.top - rect.top,
      visibleSize.width,
      visibleSize.height
    ).data;

    let visiblePixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 0) {
        // Just check R channel
        visiblePixels++;
      }
    }
    return visiblePixels;
  };

  // Fill the canvas with black, following the borders of the element
  // We end up using a path to take in account border radiuses, clips, etc.
  drawElementOnCanvas(element, ctx, rect, rect, "white");

  // Calculate the total pixels first, before checking the visible ones
  const totalPixels = countVisiblePixels();

  // Find all elements that can possibly intersect with the element
  // For this, we make a simple grid of points following ELEMENT_SAMPLING_RATE and check at each of those points
  // Hence, we end up with (1 / ELEMENT_SAMPLING_RATE) ^ 2 points (or less if the element is too small)
  const foundElements = await Promise.all(
    Array.from({ length: Math.ceil(1 / ELEMENT_SAMPLING_RATE) }).map(
      async (_, i) => {
        const elements = document.elementsFromPoint(
          rect.left + rect.width * ELEMENT_SAMPLING_RATE * i,
          rect.top + rect.height * ELEMENT_SAMPLING_RATE * i
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

  // After that, we remove duplicates and flatten the array
  const uniqueElements = Array.from(
    new Set(foundElements.flat().filter((el) => el !== element))
  );

  // Finally, we remove all elements that have a lower zIndex, or are parents (that have lower/no zIndex)
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

  // Finally, remove anything that is a children of any other non-filtered element
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
      drawElementOnCanvas(el, ctx, elRect, rect, "black");
    })
  );

  // Count pixels that are visible after drawing all the elements
  const visiblePixels = countVisiblePixels();
  canvas.remove();

  // Prevent NaN
  if (totalPixels === 0 || visiblePixels === 0) {
    return 0;
  }

  return visiblePixels / totalPixels;
}

/*
 * Draws an element on a canvas, following its border radius, clip path, etc.
 * @param element The element to draw
 */
function drawElementOnCanvas(
  element: Element,
  ctx: CanvasRenderingContext2D,
  rect: DOMRect,
  baseRect: DOMRect,
  color = "black"
) {
  const path = new Path2D();

  const styles = window.getComputedStyle(element);

  // baseRect is basically the position of the canvas on the screen
  // This allows offsetting the element's position to the canvas's position

  const radius = styles.borderRadius?.split(" ").map((r) => parseFloat(r));
  const clipPath = styles.clipPath;

  const offsetRect = {
    top: Math.max(rect.top - baseRect.top, 0),
    bottom: Math.min(rect.bottom - baseRect.top, baseRect.height),
    left: Math.max(rect.left - baseRect.left, 0),
    right: Math.min(rect.right - baseRect.left, baseRect.width),
    width:
      Math.min(rect.right - baseRect.left, baseRect.width) -
      Math.max(rect.left - baseRect.left, 0),
    height:
      Math.min(rect.bottom - baseRect.top, baseRect.height) -
      Math.max(rect.top - baseRect.top, 0),
  };

  if (radius) {
    if (radius.length === 1) radius[1] = radius[0];
    if (radius.length === 2) radius[2] = radius[0];
    if (radius.length === 3) radius[3] = radius[1];

    path.moveTo(offsetRect.left + radius[0], offsetRect.top);
    path.arcTo(
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
  } else {
    path.rect(
      offsetRect.left,
      offsetRect.top,
      offsetRect.width,
      offsetRect.height
    );
  }

  if (clipPath && clipPath !== "none") {
    const clip = new Path2D(clipPath);
    path.addPath(clip);
  }

  ctx.fillStyle = color;
  ctx.fill(path);
}
