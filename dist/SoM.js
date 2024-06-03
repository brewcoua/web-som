// src/constants.ts
var SELECTORS = [
  "a:not(:has(img))",
  "a img",
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
  '[role="spinbutton"]'
];
var VISIBILITY_RATIO = 0.6;
var ELEMENT_SAMPLING_RATE = 0.1;

// src/domain/filter.ts
class Filter {
}

// src/filters/visibility.ts
class VisibilityFilter extends Filter {
  constructor() {
    super(...arguments);
  }
  async apply(elements) {
    const visibleElements = await Promise.all(elements.map(async (element) => {
      if (element.offsetWidth === 0 && element.offsetHeight === 0) {
        return null;
      }
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") {
        return null;
      }
      let parent = element.parentElement;
      let passed = true;
      while (parent !== null) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.display === "none" || parentStyle.visibility === "hidden" || parentStyle.pointerEvents === "none") {
          passed = false;
          break;
        }
        parent = parent.parentElement;
      }
      if (!passed) {
        return null;
      }
      const isVisible = await this.isElementVisible(element);
      if (!isVisible) {
        return null;
      }
      return element;
    }));
    return visibleElements.filter((element) => element !== null);
  }
  async isElementVisible(element) {
    return new Promise((resolve) => {
      const observer = new IntersectionObserver(async (entries) => {
        const entry = entries[0];
        observer.disconnect();
        if (entry.intersectionRatio < VISIBILITY_RATIO) {
          resolve(false);
          return;
        }
        const rect = element.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) {
          resolve(false);
          return;
        }
        if (rect.width >= window.innerWidth * 0.8 || rect.height >= window.innerHeight * 0.8) {
          resolve(false);
          return;
        }
        const visibleAreaRatio = await this.getVisibilityRatio(element, rect);
        resolve(visibleAreaRatio >= VISIBILITY_RATIO);
      });
      observer.observe(element);
    });
  }
  async getVisibilityRatio(element, rect) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", {
      willReadFrequently: true
    });
    if (!ctx) {
      throw new Error("Could not get 2D context");
    }
    const elementZIndex = parseInt(window.getComputedStyle(element).zIndex || "0", 10);
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const visibleRect = {
      top: Math.max(0, rect.top),
      left: Math.max(0, rect.left),
      bottom: Math.min(window.innerHeight, rect.bottom),
      right: Math.min(window.innerWidth, rect.right),
      width: rect.width,
      height: rect.height
    };
    visibleRect.width = visibleRect.right - visibleRect.left;
    visibleRect.height = visibleRect.bottom - visibleRect.top;
    this.drawElement(element, ctx, rect, rect, "white");
    const totalPixels = this.countVisiblePixels(ctx, {
      top: visibleRect.top - rect.top,
      left: visibleRect.left - rect.left,
      width: canvas.width,
      height: canvas.height
    });
    const foundElements = await Promise.all(Array.from({ length: Math.ceil(1 / ELEMENT_SAMPLING_RATE) }).map(async (_, i) => {
      return Promise.all(Array.from({ length: Math.ceil(1 / ELEMENT_SAMPLING_RATE) }).map(async (_2, j) => {
        const elements2 = document.elementsFromPoint(rect.left + rect.width * ELEMENT_SAMPLING_RATE * i, rect.top + rect.height * ELEMENT_SAMPLING_RATE * j);
        if (!elements2.includes(element)) {
          return [];
        }
        const currentIndex = elements2.indexOf(element);
        return elements2.slice(0, currentIndex);
      }));
    }));
    const uniqueElements = Array.from(new Set(foundElements.flat(2).filter((el) => el !== element)));
    let elements = [];
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
    elements = elements.filter((el) => {
      for (const other of elements) {
        if (el !== other && other.contains(el)) {
          return false;
        }
      }
      return true;
    });
    await Promise.all(elements.map(async (el) => {
      const elRect = el.getBoundingClientRect();
      this.drawElement(el, ctx, elRect, rect, "black");
    }));
    const visiblePixels = this.countVisiblePixels(ctx, {
      top: visibleRect.top - rect.top,
      left: visibleRect.left - rect.left,
      width: visibleRect.width,
      height: visibleRect.height
    });
    canvas.remove();
    if (totalPixels === 0) {
      return 0;
    }
    return visiblePixels / totalPixels;
  }
  countVisiblePixels(ctx, rect) {
    const data = ctx.getImageData(rect.left, rect.top, rect.width, rect.height).data;
    let visiblePixels = 0;
    for (let i = 0;i < data.length; i += 4) {
      if (data[i] > 0) {
        visiblePixels++;
      }
    }
    return visiblePixels;
  }
  drawElement(element, ctx, rect, baseRect, color = "black") {
    const styles = window.getComputedStyle(element);
    const radius = styles.borderRadius?.split(" ").map((r) => parseFloat(r));
    const clipPath = styles.clipPath;
    const offsetRect = {
      top: rect.top - baseRect.top,
      bottom: rect.bottom - baseRect.top,
      left: rect.left - baseRect.left,
      right: rect.right - baseRect.left,
      width: rect.width,
      height: rect.height
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
      const path = new Path2D;
      if (radius.length === 1)
        radius[1] = radius[0];
      if (radius.length === 2)
        radius[2] = radius[0];
      if (radius.length === 3)
        radius[3] = radius[1];
      path.moveTo(offsetRect.left + radius[0], offsetRect.top);
      path.arcTo(offsetRect.right, offsetRect.top, offsetRect.right, offsetRect.bottom, radius[1]);
      path.arcTo(offsetRect.right, offsetRect.bottom, offsetRect.left, offsetRect.bottom, radius[2]);
      path.arcTo(offsetRect.left, offsetRect.bottom, offsetRect.left, offsetRect.top, radius[3]);
      path.arcTo(offsetRect.left, offsetRect.top, offsetRect.right, offsetRect.top, radius[0]);
      path.closePath();
      ctx.fill(path);
    } else {
      ctx.fillRect(offsetRect.left, offsetRect.top, offsetRect.width, offsetRect.height);
    }
  }
  pathFromPolygon(polygon, rect) {
    if (!polygon || !polygon.match(/^polygon\((.*)\)$/)) {
      throw new Error("Invalid polygon format: " + polygon);
    }
    const path = new Path2D;
    const points = polygon.match(/\d+(\.\d+)?%/g);
    if (points && points.length >= 2) {
      const startX = parseFloat(points[0]);
      const startY = parseFloat(points[1]);
      path.moveTo(startX * rect.width / 100, startY * rect.height / 100);
      for (let i = 2;i < points.length; i += 2) {
        const x = parseFloat(points[i]);
        const y = parseFloat(points[i + 1]);
        path.lineTo(x * rect.width / 100, y * rect.height / 100);
      }
      path.closePath();
    }
    return path;
  }
}
var visibility_default = VisibilityFilter;
// src/filters/nesting.ts
var SIZE_THRESHOLD = 0.9;
var QUANTITY_THRESHOLD = 3;
var PRIORITY_SELECTOR = ["a", "button", "input", "select", "textarea"];

class NestingFilter extends Filter {
  constructor() {
    super(...arguments);
  }
  async apply(elements) {
    const { top, others } = this.getTopLevelElements(elements);
    const results = await Promise.all(top.map(async (topElement) => this.compareTopWithChildren(topElement, others)));
    return results.flat();
  }
  async compareTopWithChildren(top, children) {
    if (PRIORITY_SELECTOR.some((selector) => top.matches(selector))) {
      return [top];
    }
    const branches = this.getBranches(top, children);
    const rect = top.getBoundingClientRect();
    if (branches.length <= 1) {
      return [top];
    }
    const results = await Promise.all(branches.map(async (branch) => {
      const firstHitRect = branch.top.getBoundingClientRect();
      if (firstHitRect.width / rect.width < SIZE_THRESHOLD && firstHitRect.height / rect.height < SIZE_THRESHOLD) {
        return [];
      }
      if (branch.children.length === 0) {
        return [branch.top];
      }
      return await this.compareTopWithChildren(branch.top, branch.children);
    }));
    const total = results.flat();
    if (total.length > QUANTITY_THRESHOLD) {
      return total;
    }
    return [top, ...total];
  }
  getBranches(element, elements) {
    const firstHits = this.getFirstHitChildren(element, elements);
    return firstHits.map((firstHit) => {
      const children = elements.filter((child) => !firstHits.includes(child) && firstHit.contains(child));
      return { top: firstHit, children };
    });
  }
  getFirstHitChildren(element, elements) {
    const directChildren = element.querySelectorAll(":scope > *");
    const clickableDirectChildren = Array.from(directChildren).filter((child) => elements.includes(child));
    if (clickableDirectChildren.length > 0) {
      return clickableDirectChildren;
    }
    return Array.from(directChildren).flatMap((child) => this.getFirstHitChildren(child, elements));
  }
  getTopLevelElements(elements) {
    const topLevelElements = [], nonTopLevelElements = [];
    for (const element of elements) {
      if (!elements.some((otherElement) => otherElement !== element && otherElement.contains(element))) {
        topLevelElements.push(element);
      } else {
        nonTopLevelElements.push(element);
      }
    }
    return { top: topLevelElements, others: nonTopLevelElements };
  }
}
var nesting_default = NestingFilter;
// src/loader.ts
class Loader {
  filters = {
    visibility: new visibility_default,
    nesting: new nesting_default
  };
  async loadElements() {
    const selector = SELECTORS.join(",");
    let preselectedElements = Array.from(document.querySelectorAll(selector));
    const shadowRoots = this.shadowRoots();
    for (let i = 0;i < shadowRoots.length; i++) {
      preselectedElements = preselectedElements.concat(Array.from(shadowRoots[i].querySelectorAll(selector)));
    }
    const allElements = document.querySelectorAll("*");
    let clickableElements = [];
    for (let i = 0;i < allElements.length; i++) {
      if (!allElements[i].matches(selector) && window.getComputedStyle(allElements[i]).cursor === "pointer") {
        clickableElements.push(allElements[i]);
      }
    }
    clickableElements = Array.from(clickableElements).filter((element, index, self) => self.indexOf(element) === index).filter((element) => !element.closest("svg") && !preselectedElements.some((el) => el.contains(element)));
    const visiblePreselected = await this.filters.visibility.apply(preselectedElements);
    const visibleClickable = await this.filters.visibility.apply(clickableElements);
    const nestedAll = await this.filters.nesting.apply(visibleClickable.concat(visiblePreselected));
    return visiblePreselected.concat(nestedAll).filter((element, index, self) => self.indexOf(element) === index);
  }
  shadowRoots() {
    const shadowRoots = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node2) {
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while (node = walker.nextNode()) {
      if (node && node.shadowRoot) {
        shadowRoots.push(node.shadowRoot);
      }
    }
    return shadowRoots;
  }
}

// src/ui.ts
class UI {
  display(elements) {
    const labels = [];
    const boundingBoxes = [];
    const rawBoxes = [];
    const randomColor = () => Math.floor(Math.random() * 256);
    for (let i = 0;i < elements.length; i++) {
      const element = elements[i];
      const rect = element.getBoundingClientRect();
      const div = document.createElement("div");
      div.style.left = `${rect.left}px`;
      div.style.top = `${rect.top}px`;
      div.style.width = `${rect.width}px`;
      div.style.height = `${rect.height}px`;
      div.classList.add("SoM");
      const color = [
        randomColor(),
        randomColor(),
        randomColor()
      ];
      div.style.backgroundColor = `rgba(${color.join(",")}, 0.3)`;
      document.body.appendChild(div);
      boundingBoxes.push({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        color
      });
      rawBoxes.push(div);
    }
    for (let i = 0;i < elements.length; i++) {
      const element = elements[i];
      const box = boundingBoxes[i];
      const label = document.createElement("label");
      label.textContent = `${i}`;
      label.style.color = this.colorFromLuminance(box.color);
      label.style.backgroundColor = `rgba(${box.color.join(",")}, 0.5)`;
      rawBoxes[i].appendChild(label);
      const labelRect = label.getBoundingClientRect();
      const gridSize = 10;
      const positions = [];
      for (let i2 = 0;i2 <= gridSize; i2++) {
        positions.push({
          top: box.top - labelRect.height,
          left: box.left + box.width / gridSize * i2 - labelRect.width / 2
        });
        positions.push({
          top: box.bottom,
          left: box.left + box.width / gridSize * i2 - labelRect.width / 2
        });
        positions.push({
          top: box.top + box.height / gridSize * i2 - labelRect.height / 2,
          left: box.left - labelRect.width
        });
        positions.push({
          top: box.top + box.height / gridSize * i2 - labelRect.height / 2,
          left: box.right
        });
      }
      const scores = positions.map((position) => {
        let score = 0;
        if (position.top < 0 || position.top + labelRect.height > window.innerHeight || position.left < 0 || position.left + labelRect.width > window.innerWidth) {
          score += Infinity;
        } else {
          labels.concat(boundingBoxes).forEach((existing) => {
            const overlapWidth = Math.max(0, Math.min(position.left + labelRect.width, existing.left + existing.width) - Math.max(position.left, existing.left));
            const overlapHeight = Math.max(0, Math.min(position.top + labelRect.height, existing.top + existing.height) - Math.max(position.top, existing.top));
            score += overlapWidth * overlapHeight;
          });
        }
        return score;
      });
      const bestPosition = positions[scores.indexOf(Math.min(...scores))];
      label.style.top = `${bestPosition.top - box.top}px`;
      label.style.left = `${bestPosition.left - box.left}px`;
      labels.push({
        top: bestPosition.top,
        left: bestPosition.left,
        right: bestPosition.left + labelRect.width,
        bottom: bestPosition.top + labelRect.height,
        width: labelRect.width,
        height: labelRect.height
      });
      element.setAttribute("data-SoM", `${i}`);
    }
  }
  colorFromLuminance(color) {
    const [r, g, b] = color.map((c) => c / 255);
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 0.5 ? "black" : "white";
  }
}

// src/style.css
var style_default = ".SoM{position:fixed;z-index:2147483646;pointer-events:none}.SoM>label{position:absolute;padding:0 3px;font-size:1rem;font-weight:700;line-height:1.2rem;white-space:nowrap;font-family:\"Courier New\",Courier,monospace}";

// src/main.ts
class SoM {
  loader = new Loader;
  ui = new UI;
  async display() {
    this.log("Displaying...");
    const startTime = performance.now();
    const elements = await this.loader.loadElements();
    this.clear();
    this.ui.display(elements);
    this.log("Done!", `Took ${performance.now() - startTime}ms to display ${elements.length} elements.`);
  }
  clear() {
    document.querySelectorAll(".SoM").forEach((element) => {
      element.remove();
    });
    document.querySelectorAll("[data-som]").forEach((element) => {
      element.removeAttribute("data-som");
    });
  }
  hide() {
    document.querySelectorAll(".SoM").forEach((element) => element.style.display = "none");
  }
  show() {
    document.querySelectorAll(".SoM").forEach((element) => element.style.display = "block");
  }
  resolve(id) {
    return document.querySelector(`[data-som="${id}"]`);
  }
  log(...args) {
    console.log("%cSoM", "color: white; background: #007bff; padding: 2px 5px; border-radius: 5px;", ...args);
  }
}
if (!document.getElementById("SoM-styles")) {
  const styleElement = document.createElement("style");
  styleElement.id = "SoM-styles";
  styleElement.innerHTML = style_default;
  document.head.appendChild(styleElement);
}
window.SoM = new SoM;
window.SoM.log("Ready!");
