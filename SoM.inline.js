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

const VISIBILITY_RATIO = 0.6; // Required visibility ratio for an element to be considered visible

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
    const isDebug = element.innerHTML.trim() === "Supprimer l'historique";

    // Use IntersectionObserver to check if the element is visible
    return new Promise((resolve) => {
      const observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        observer.disconnect();

        if (isDebug) {
            console.log(entry, entry.intersectionRatio >= VISIBILITY_RATIO);
        }
        resolve(entry.intersectionRatio >= VISIBILITY_RATIO);
      });
      observer.observe(element);
    });
  }

  filterNestedElements(elements) {
    return elements.filter((element) => {
        let parent = element.parentElement;
        while (parent !== null) {
            if (elements.includes(parent)) {
            return false;
            }
            parent = parent.parentElement;
        }
        return true;
    });
  }

  async loadElements() {
    // First, select all elements that are clickable by default, then add the ones that have an onClick event
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

    // Then, filter elements that are not visible, either because of style or because the window needs to be scrolled
    const fullElements = Array.from(preselectedElements)
      .concat(clickableElements)
      .filter((element, index, self) => self.indexOf(element) === index);

    const elements = [];
    for (let i = 0; i < fullElements.length; i++) {
      const element = fullElements[i];
      if (element.offsetWidth === 0 && element.offsetHeight === 0) {
        continue;
      }

      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        continue;
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
        continue;
      }

      // Check if the element is in the viewport
      const rect = element.getBoundingClientRect();
      if (
        rect.top >= window.innerHeight ||
        rect.bottom <= 0 ||
        rect.left >= window.innerWidth ||
        rect.right <= 0
      ) {
        continue;
      }

      const isVisible = await this.isElementVisible(element);
      if (!isVisible) {
        continue;
      }

      elements.push(element);
    }

    return this.filterNestedElements(elements);
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
                existing.left + existing.width,
              ) - Math.max(position.left, existing.left),
            );
            const overlapHeight = Math.max(
              0,
              Math.min(
                position.top + labelRect.height,
                existing.top + existing.height,
              ) - Math.max(position.top, existing.top),
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
