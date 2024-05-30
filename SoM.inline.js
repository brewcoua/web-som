const SELECTORS = [
  "a[href]:not(:has(img))",
  "a[href] img",
  "button",
  'input:not([type="hidden"])',
  "select",
  "textarea",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  ".btn",
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="input"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="treeitem"]',
  '[role="gridcell"]',
  '[role="search"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
];

// Required visibility ratio for an element to be considered visible
const VISIBILITY_RATIO = 0.6;

// Rate at which elements are sampled for elements on point
// e.g. 0.1 => Make a grid and check on every point every 10% of the size of the element
// This is used to make sure that every element that intersects with the element is checked
const ELEMENT_SAMPLING_RATE = 0.1;

class SoM {
  constructor() {
    this.elements = [];
    this.boxes = [];
  }

  colorFromLuminance(color) {
    const [r, g, b] = color.map((c) => c / 255.0);
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 0.5 ? "black" : "white";
  }

  async isElementVisible(element) {
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

        const visibleAreaRatio = await this.calculateVisibleAreaRatio(
          element,
          rect
        );

        resolve(visibleAreaRatio >= VISIBILITY_RATIO);
      });
      observer.observe(element);
    });
  }

  drawElementOnCanvas(element, ctx, rect, baseRect, color = "black") {
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

  async calculateVisibleAreaRatio(element, rect, displayCanvas = false) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const elementZIndex = parseInt(
      window.getComputedStyle(element).zIndex || 0,
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
    this.drawElementOnCanvas(element, ctx, rect, rect, "white");

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
    let elements = [];
    for (const el of uniqueElements) {
      const elZIndex = parseInt(window.getComputedStyle(el).zIndex || 0, 10);
      if (elZIndex < elementZIndex) {
        continue;
      }

      // Remove anything that has a direct relationship with the element (parents, children, etc.)
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
        this.drawElementOnCanvas(el, ctx, elRect, rect, "black");
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

  async filterVisibleElements(elements) {
    const visibleElements = await Promise.all(
      elements.map(async (element) => {
        if (element.offsetWidth === 0 && element.offsetHeight === 0) {
          return null;
        }

        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") {
          return null;
        }

        // Check if any of the element's parents are hidden
        let parent = element.parentElement;
        let passed = true;
        while (parent !== null) {
          const parentStyle = window.getComputedStyle(parent);
          if (
            parentStyle.display === "none" ||
            parentStyle.visibility === "hidden"
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

        const isVisible = await this.isElementVisible(element);
        if (!isVisible) {
          return null;
        }

        return element;
      })
    );

    return visibleElements.filter((element) => element !== null);
  }

  async filterNestedElements(elements) {
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

    return filteredElements.filter((element) => element !== null);
  }

  async loadElements() {
    const preselectedElements = document.querySelectorAll(SELECTORS.join(","));
    const allElements = document.querySelectorAll("*");

    const clickableElements = [];
    for (let i = 0; i < allElements.length; i++) {
      if (
        allElements[i].onclick !== null ||
        // Check if the style for cursor is pointer
        window.getComputedStyle(allElements[i]).cursor === "pointer"
      ) {
        clickableElements.push(allElements[i]);
      }
    }

    const fullElements = Array.from(preselectedElements)
      .concat(clickableElements)
      .filter((element, index, self) => self.indexOf(element) === index);

    const elements = await this.filterVisibleElements(fullElements);
    return await this.filterNestedElements(elements);
  }

  async display() {
    this.clear();

    const elements = await this.loadElements();

    const labels = [];
    const boundingBoxes = [];

    this.elements.push(...elements);

    const randomColor = () => Math.floor(Math.random() * 256);

    // First, define the bounding boxes
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      const rect = element.getBoundingClientRect();
      const div = document.createElement("div");
      div.style.left = `${rect.left}px`;
      div.style.top = `${rect.top}px`;
      div.style.width = `${rect.width}px`;
      div.style.height = `${rect.height}px`;
      div.classList.add("SoM");

      const color = [randomColor(), randomColor(), randomColor()];
      div.style.backgroundColor = `rgba(${color.join(",")}, 0.5)`;

      document.body.appendChild(div);

      boundingBoxes.push({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        color: color,
      });

      this.boxes.push(div);
    }

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const box = boundingBoxes[i];

      const label = document.createElement("label");
      label.textContent = i;
      label.style.color = this.colorFromLuminance(box.color);
      label.style.backgroundColor = `rgba(${box.color.join(",")}, 0.7)`;

      this.boxes[i].appendChild(label);

      const labelRect = label.getBoundingClientRect();

      const gridSize = 10;
      const positions = [];
      for (let i = 0; i <= gridSize; i++) {
        // Top side
        positions.push({
          top: box.top - labelRect.height,
          left: box.left + (box.width / gridSize) * i - labelRect.width / 2,
        });
        // Bottom side
        positions.push({
          top: box.bottom,
          left: box.left + (box.width / gridSize) * i - labelRect.width / 2,
        });
        // Left side
        positions.push({
          top: box.top + (box.height / gridSize) * i - labelRect.height / 2,
          left: box.left - labelRect.width,
        });
        // Right side
        positions.push({
          top: box.top + (box.height / gridSize) * i - labelRect.height / 2,
          left: box.right,
        });
      }

      // Calculate score for each position
      const scores = positions.map((position) => {
        let score = 0;

        // Check if position is within bounds
        if (
          position.top < 0 ||
          position.top + labelRect.height > window.innerHeight ||
          position.left < 0 ||
          position.left + labelRect.width > window.innerWidth
        ) {
          score += Infinity; // Out of bounds, set score to infinity
        } else {
          // Calculate overlap with other labels and bounding boxes
          labels.concat(boundingBoxes).forEach((existing) => {
            const overlapWidth = Math.max(
              0,
              Math.min(
                position.left + labelRect.width,
                existing.left + existing.width
              ) - Math.max(position.left, existing.left)
            );
            const overlapHeight = Math.max(
              0,
              Math.min(
                position.top + labelRect.height,
                existing.top + existing.height
              ) - Math.max(position.top, existing.top)
            );
            score += overlapWidth * overlapHeight; // Add overlap area to score
          });
        }

        return score;
      });

      // Select position with lowest score
      const bestPosition = positions[scores.indexOf(Math.min(...scores))];

      // Set label position
      label.style.top = `${bestPosition.top - box.top}px`;
      label.style.left = `${bestPosition.left - box.left}px`;

      // Add the new label's position to the array
      labels.push({
        top: bestPosition.top,
        left: bestPosition.left,
        width: labelRect.width,
        height: labelRect.height,
      });

      element.setAttribute("data-SoM", i);
    }
  }

  hide() {
    this.boxes.forEach((label) => (label.style.display = "none"));
  }

  show() {
    this.boxes.forEach((label) => (label.style.display = "block"));
  }

  clear() {
    this.elements.forEach((element) => element.removeAttribute("data-SoM"));
    this.elements.length = 0;

    this.boxes.forEach((label) => label.remove());
    this.boxes.length = 0;
  }

  resolve(id) {
    if (id === null) {
      return null;
    }

    return this.elements[id];
  }
}

window.SoM = new SoM();
