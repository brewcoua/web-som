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
var EDITABLE_SELECTORS = [
  'input[type="text"]',
  'input[type="password"]',
  'input[type="email"]',
  'input[type="tel"]',
  'input[type="number"]',
  'input[type="search"]',
  'input[type="url"]',
  'input[type="date"]',
  'input[type="time"]',
  'input[type="datetime-local"]',
  'input[type="month"]',
  'input[type="week"]',
  'input[type="color"]',
  "textarea",
  '[contenteditable="true"]'
];
var VISIBILITY_RATIO = 0.6;
var MAX_COVER_RATIO = 0.8;
var ELEMENT_BATCH_SIZE = 10;
var SURROUNDING_RADIUS = 200;
var MAX_LUMINANCE = 0.7;
var MIN_LUMINANCE = 0.25;
var MIN_SATURATION = 0.3;

// src/domain/Filter.ts
class Filter {
}

// src/filters/visibility/quad.ts
class Rectangle {
  x;
  y;
  width;
  height;
  element;
  constructor(x, y, width, height, element = null) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.element = element;
  }
  contains(rect) {
    return rect.x >= this.x && rect.x + rect.width <= this.x + this.width && rect.y >= this.y && rect.y + rect.height <= this.y + this.height;
  }
  intersects(rect) {
    return !(rect.x > this.x + this.width || rect.x + rect.width < this.x || rect.y > this.y + this.height || rect.y + rect.height < this.y);
  }
}

class QuadTree {
  boundary;
  capacity;
  elements;
  divided;
  northeast;
  northwest;
  southeast;
  southwest;
  constructor(boundary, capacity) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.elements = [];
    this.divided = false;
    this.northeast = null;
    this.northwest = null;
    this.southeast = null;
    this.southwest = null;
  }
  subdivide() {
    const x = this.boundary.x;
    const y = this.boundary.y;
    const w = this.boundary.width / 2;
    const h = this.boundary.height / 2;
    const ne = new Rectangle(x + w, y, w, h);
    const nw = new Rectangle(x, y, w, h);
    const se = new Rectangle(x + w, y + h, w, h);
    const sw = new Rectangle(x, y + h, w, h);
    this.northeast = new QuadTree(ne, this.capacity);
    this.northwest = new QuadTree(nw, this.capacity);
    this.southeast = new QuadTree(se, this.capacity);
    this.southwest = new QuadTree(sw, this.capacity);
    this.divided = true;
  }
  insert(element) {
    if (!this.boundary.intersects(element)) {
      return false;
    }
    if (this.elements.length < this.capacity && !this.divided) {
      this.elements.push(element);
      return true;
    } else {
      if (!this.divided) {
        this.subdivide();
      }
      let inserted = false;
      if (this.northeast.boundary.intersects(element)) {
        inserted = this.northeast.insert(element) || inserted;
      }
      if (this.northwest.boundary.intersects(element)) {
        inserted = this.northwest.insert(element) || inserted;
      }
      if (this.southeast.boundary.intersects(element)) {
        inserted = this.southeast.insert(element) || inserted;
      }
      if (this.southwest.boundary.intersects(element)) {
        inserted = this.southwest.insert(element) || inserted;
      }
      return inserted;
    }
  }
  query(range, found = []) {
    if (!this.boundary.intersects(range)) {
      return found;
    }
    for (let element of this.elements) {
      if (range.intersects(element)) {
        found.push(element);
      }
    }
    if (this.divided) {
      this.northwest.query(range, found);
      this.northeast.query(range, found);
      this.southwest.query(range, found);
      this.southeast.query(range, found);
    }
    return found.filter((el, i, arr) => arr.indexOf(el) === i);
  }
}

// src/filters/visibility/utils.ts
function isAbove(element, referenceElement) {
  function getEffectiveZIndex(element2) {
    while (element2) {
      const zIndex = window.getComputedStyle(element2).zIndex;
      if (zIndex !== "auto") {
        const zIndexValue = parseInt(zIndex, 10);
        return isNaN(zIndexValue) ? 0 : zIndexValue;
      }
      element2 = element2.parentElement;
    }
    return 0;
  }
  const elementZIndex = getEffectiveZIndex(element);
  const referenceElementZIndex = getEffectiveZIndex(referenceElement);
  const elementPosition = element.compareDocumentPosition(referenceElement);
  if (elementPosition & Node.DOCUMENT_POSITION_CONTAINS || elementPosition & Node.DOCUMENT_POSITION_CONTAINED_BY) {
    return false;
  }
  if (elementZIndex !== referenceElementZIndex) {
    return elementZIndex < referenceElementZIndex;
  }
  return !!(elementPosition & Node.DOCUMENT_POSITION_PRECEDING);
}
function isVisible(element) {
  if (element.offsetWidth === 0 && element.offsetHeight === 0) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") {
    return false;
  }
  let parent = element.parentElement;
  while (parent !== null) {
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.display === "none" || parentStyle.visibility === "hidden" || parentStyle.pointerEvents === "none") {
      return false;
    }
    parent = parent.parentElement;
  }
  return true;
}

// src/filters/visibility/canvas.ts
class VisibilityCanvas {
  element;
  canvas;
  ctx;
  rect;
  visibleRect;
  constructor(element) {
    this.element = element;
    this.element = element;
    this.rect = this.element.getBoundingClientRect();
    this.canvas = new OffscreenCanvas(this.rect.width, this.rect.height);
    this.ctx = this.canvas.getContext("2d", {
      willReadFrequently: true
    });
    this.ctx.imageSmoothingEnabled = false;
    this.visibleRect = {
      top: Math.max(0, this.rect.top),
      left: Math.max(0, this.rect.left),
      bottom: Math.min(window.innerHeight, this.rect.bottom),
      right: Math.min(window.innerWidth, this.rect.right),
      width: this.rect.width,
      height: this.rect.height
    };
    this.visibleRect.width = this.visibleRect.right - this.visibleRect.left;
    this.visibleRect.height = this.visibleRect.bottom - this.visibleRect.top;
  }
  async eval(qt) {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawElement(this.element, "white");
    const canvasVisRect = {
      top: this.visibleRect.top - this.rect.top,
      bottom: this.visibleRect.bottom - this.rect.top,
      left: this.visibleRect.left - this.rect.left,
      right: this.visibleRect.right - this.rect.left,
      width: this.canvas.width,
      height: this.canvas.height
    };
    const totalPixels = await this.countVisiblePixels(canvasVisRect);
    if (totalPixels === 0)
      return 0;
    const elements = this.getIntersectingElements(qt);
    for (const el of elements) {
      this.drawElement(el, "black");
    }
    const visiblePixels = await this.countVisiblePixels(canvasVisRect);
    return visiblePixels / totalPixels;
  }
  getIntersectingElements(qt) {
    const range = new Rectangle(this.rect.left, this.rect.right, this.rect.width, this.rect.height, this.element);
    const candidates = qt.query(range);
    return candidates.map((candidate) => candidate.element).filter((el) => el != this.element && isAbove(this.element, el) && isVisible(el));
  }
  async countVisiblePixels(visibleRect) {
    const imageData = this.ctx.getImageData(visibleRect.left, visibleRect.top, visibleRect.width, visibleRect.height);
    let visiblePixels = 0;
    for (let i = 0;i < imageData.data.length; i += 4) {
      const isWhite = imageData.data[i + 1] === 255;
      if (isWhite) {
        visiblePixels++;
      }
    }
    return visiblePixels;
  }
  drawElement(element, color = "black") {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    const radius = styles.borderRadius?.split(" ").map((r) => parseFloat(r));
    const clipPath = styles.clipPath;
    const offsetRect = {
      top: rect.top - this.rect.top,
      bottom: rect.bottom - this.rect.top,
      left: rect.left - this.rect.left,
      right: rect.right - this.rect.left,
      width: rect.width,
      height: rect.height
    };
    offsetRect.width = offsetRect.right - offsetRect.left;
    offsetRect.height = offsetRect.bottom - offsetRect.top;
    this.ctx.fillStyle = color;
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
            this.ctx.fill(path);
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
      this.ctx.fill(path);
    } else {
      this.ctx.fillRect(offsetRect.left, offsetRect.top, offsetRect.width, offsetRect.height);
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

// src/filters/visibility/index.ts
class VisibilityFilter extends Filter {
  constructor() {
    super(...arguments);
  }
  qt;
  async apply(elements) {
    this.qt = this.mapQuadTree();
    const results = await Promise.all([
      this.applyScoped(elements.fixed),
      this.applyScoped(elements.unknown)
    ]);
    return {
      fixed: results[0],
      unknown: results[1]
    };
  }
  async applyScoped(elements) {
    const results = await Promise.all(Array.from({
      length: Math.ceil(elements.length / ELEMENT_BATCH_SIZE)
    }).map(async (_, i) => {
      const batch = elements.slice(i * ELEMENT_BATCH_SIZE, (i + 1) * ELEMENT_BATCH_SIZE).filter((el) => isVisible(el));
      const visibleElements = [];
      for (const element of batch) {
        const isVisible2 = await this.isDeepVisible(element);
        if (isVisible2) {
          visibleElements.push(element);
        }
      }
      return visibleElements;
    }));
    return results.flat();
  }
  mapQuadTree() {
    const boundary = new Rectangle(0, 0, window.innerWidth, window.innerHeight);
    const qt = new QuadTree(boundary, 4);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        const element = node;
        if (isVisible(element)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    });
    let currentNode = walker.currentNode;
    while (currentNode) {
      const element = currentNode;
      const rect = element.getBoundingClientRect();
      qt.insert(new Rectangle(rect.left, rect.top, rect.width, rect.height, element));
      currentNode = walker.nextNode();
    }
    return qt;
  }
  async isDeepVisible(element) {
    return new Promise((resolve) => {
      const observer = new IntersectionObserver(async (entries) => {
        const entry = entries[0];
        observer.disconnect();
        if (entry.intersectionRatio < VISIBILITY_RATIO) {
          resolve(false);
          return;
        }
        const rect = element.getBoundingClientRect();
        if (rect.width >= window.innerWidth * MAX_COVER_RATIO || rect.height >= window.innerHeight * MAX_COVER_RATIO) {
          resolve(false);
          return;
        }
        const canvas2 = new VisibilityCanvas(element);
        const visibleAreaRatio = await canvas2.eval(this.qt);
        resolve(visibleAreaRatio >= VISIBILITY_RATIO);
      });
      observer.observe(element);
    });
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
    const fullElements = elements.fixed.concat(elements.unknown);
    const { top, others } = this.getTopLevelElements(fullElements);
    const results = await Promise.all(top.map(async (topElement) => this.compareTopWithChildren(topElement, others)));
    return {
      fixed: elements.fixed,
      unknown: results.flat().filter((el) => elements.fixed.indexOf(el) === -1)
    };
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
      return this.compareTopWithChildren(branch.top, branch.children);
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
    let fixedElements = Array.from(document.querySelectorAll(selector));
    const shadowRoots = this.shadowRoots();
    for (let i = 0;i < shadowRoots.length; i++) {
      fixedElements = fixedElements.concat(Array.from(shadowRoots[i].querySelectorAll(selector)));
    }
    let unknownElements = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode() {
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while (node = walker.nextNode()) {
      const el = node;
      if (!el.matches(selector) && window.getComputedStyle(el).cursor === "pointer") {
        unknownElements.push(el);
      }
    }
    unknownElements = Array.from(unknownElements).filter((element, index, self) => self.indexOf(element) === index).filter((element) => !element.closest("svg") && !fixedElements.some((el) => el.contains(element)));
    let interactive = {
      fixed: fixedElements,
      unknown: unknownElements
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

// src/ui/colors.ts
class UIColors {
  contrastColor(element, surroundingColors) {
    const style = window.getComputedStyle(element);
    const bgColor = Color.fromCSS(style.backgroundColor);
    return this.getBestContrastColor([bgColor, ...surroundingColors]);
  }
  getBestContrastColor(colors) {
    const complimentaryColors = colors.filter((color2) => color2.a > 0).map((color2) => color2.complimentary());
    let color;
    if (complimentaryColors.length === 0) {
      color = new Color(Math.floor(Math.random() * 255), Math.floor(Math.random() * 255), Math.floor(Math.random() * 255));
    } else {
      color = this.getAverageColor(complimentaryColors);
    }
    if (color.luminance() > MAX_LUMINANCE) {
      color = color.withLuminance(MAX_LUMINANCE);
    } else if (color.luminance() < MIN_LUMINANCE) {
      color = color.withLuminance(MIN_LUMINANCE);
    }
    if (color.saturation() < MIN_SATURATION) {
      color = color.withSaturation(MIN_SATURATION);
    }
    return color;
  }
  getAverageColor(colors) {
    const r = colors.reduce((acc, color) => acc + color.r, 0) / colors.length;
    const g = colors.reduce((acc, color) => acc + color.g, 0) / colors.length;
    const b = colors.reduce((acc, color) => acc + color.b, 0) / colors.length;
    return new Color(r, g, b);
  }
}

class Color {
  r;
  g;
  b;
  a;
  constructor(r, g, b, a = 255) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
    if (r < 0 || r > 255) {
      throw new Error(`Invalid red value: ${r}`);
    }
    if (g < 0 || g > 255) {
      throw new Error(`Invalid green value: ${g}`);
    }
    if (b < 0 || b > 255) {
      throw new Error(`Invalid blue value: ${b}`);
    }
    if (a < 0 || a > 255) {
      throw new Error(`Invalid alpha value: ${a}`);
    }
    this.r = Math.round(r);
    this.g = Math.round(g);
    this.b = Math.round(b);
    this.a = Math.round(a);
  }
  static fromCSS(css) {
    if (css.startsWith("#")) {
      return Color.fromHex(css);
    }
    if (css.startsWith("rgb")) {
      const rgb = css.replace(/rgba?\(/, "").replace(")", "").split(",").map((c) => parseInt(c.trim()));
      return new Color(...rgb);
    }
    if (css.startsWith("hsl")) {
      const hsl = css.replace(/hsla?\(/, "").replace(")", "").split(",").map((c) => parseFloat(c.trim()));
      return Color.fromHSL({ h: hsl[0], s: hsl[1], l: hsl[2] });
    }
    const hex = NamedColors[css.toLowerCase()];
    if (hex) {
      return Color.fromHex(hex);
    }
    throw new Error(`Unknown color format: ${css}`);
  }
  static fromHex(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3) {
      hex = hex.split("").map((char) => char + char).join("");
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if (hex.length === 8) {
      const a = parseInt(hex.substring(6, 8), 16);
      return new Color(r, g, b, a);
    }
    return new Color(r, g, b);
  }
  static fromHSL(hsl) {
    const h = hsl.h;
    const s = hsl.s;
    const l = hsl.l;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p2, q2, t) => {
        if (t < 0)
          t += 1;
        if (t > 1)
          t -= 1;
        if (t < 0.16666666666666666)
          return p2 + (q2 - p2) * 6 * t;
        if (t < 0.5)
          return q2;
        if (t < 0.6666666666666666)
          return p2 + (q2 - p2) * (0.6666666666666666 - t) * 6;
        return p2;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 0.3333333333333333);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 0.3333333333333333);
    }
    return new Color(r * 255, g * 255, b * 255);
  }
  luminance() {
    const r = this.r / 255;
    const g = this.g / 255;
    const b = this.b / 255;
    const a = [r, g, b].map((c) => {
      if (c <= 0.03928) {
        return c / 12.92;
      }
      return Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  withLuminance(luminance) {
    const l = this.luminance();
    const ratio = luminance / l;
    const r = Math.min(255, this.r * ratio);
    const g = Math.min(255, this.g * ratio);
    const b = Math.min(255, this.b * ratio);
    return new Color(r, g, b, this.a);
  }
  saturation() {
    return this.toHsl().s;
  }
  withSaturation(saturation) {
    const hsl = this.toHsl();
    hsl.s = saturation;
    return Color.fromHSL(hsl);
  }
  contrast(color) {
    const l1 = this.luminance();
    const l2 = color.luminance();
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  complimentary() {
    const hsl = this.toHsl();
    hsl.h = (hsl.h + 0.5) % 1;
    return Color.fromHSL(hsl);
  }
  toHex() {
    const r = this.r.toString(16).padStart(2, "0");
    const g = this.g.toString(16).padStart(2, "0");
    const b = this.b.toString(16).padStart(2, "0");
    if (this.a < 255) {
      const a = this.a.toString(16).padStart(2, "0");
      return `#${r}${g}${b}${a}`;
    }
    return `#${r}${g}${b}`;
  }
  toHsl() {
    const r = this.r / 255;
    const g = this.g / 255;
    const b = this.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = (max + min) / 2;
    let s = (max + min) / 2;
    let l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    return { h, s, l, a: this.a / 255 };
  }
  toString() {
    return this.toHex();
  }
}
var NamedColors = {
  aliceblue: "#f0f8ff",
  antiquewhite: "#faebd7",
  aqua: "#00ffff",
  aquamarine: "#7fffd4",
  azure: "#f0ffff",
  beige: "#f5f5dc",
  bisque: "#ffe4c4",
  black: "#000000",
  blanchedalmond: "#ffebcd",
  blue: "#0000ff",
  blueviolet: "#8a2be2",
  brown: "#a52a2a",
  burlywood: "#deb887",
  cadetblue: "#5f9ea0",
  chartreuse: "#7fff00",
  chocolate: "#d2691e",
  coral: "#ff7f50",
  cornflowerblue: "#6495ed",
  cornsilk: "#fff8dc",
  crimson: "#dc143c",
  cyan: "#00ffff",
  darkblue: "#00008b",
  darkcyan: "#008b8b",
  darkgoldenrod: "#b8860b",
  darkgray: "#a9a9a9",
  darkgreen: "#006400",
  darkkhaki: "#bdb76b",
  darkmagenta: "#8b008b",
  darkolivegreen: "#556b2f",
  darkorange: "#ff8c00",
  darkorchid: "#9932cc",
  darkred: "#8b0000",
  darksalmon: "#e9967a",
  darkseagreen: "#8fbc8f",
  darkslateblue: "#483d8b",
  darkslategray: "#2f4f4f",
  darkturquoise: "#00ced1",
  darkviolet: "#9400d3",
  deeppink: "#ff1493",
  deepskyblue: "#00bfff",
  dimgray: "#696969",
  dodgerblue: "#1e90ff",
  firebrick: "#b22222",
  floralwhite: "#fffaf0",
  forestgreen: "#228b22",
  fuchsia: "#ff00ff",
  gainsboro: "#dcdcdc",
  ghostwhite: "#f8f8ff",
  gold: "#ffd700",
  goldenrod: "#daa520",
  gray: "#808080",
  green: "#008000",
  greenyellow: "#adff2f",
  honeydew: "#f0fff0",
  hotpink: "#ff69b4",
  "indianred ": "#cd5c5c",
  indigo: "#4b0082",
  ivory: "#fffff0",
  khaki: "#f0e68c",
  lavender: "#e6e6fa",
  lavenderblush: "#fff0f5",
  lawngreen: "#7cfc00",
  lemonchiffon: "#fffacd",
  lightblue: "#add8e6",
  lightcoral: "#f08080",
  lightcyan: "#e0ffff",
  lightgoldenrodyellow: "#fafad2",
  lightgrey: "#d3d3d3",
  lightgreen: "#90ee90",
  lightpink: "#ffb6c1",
  lightsalmon: "#ffa07a",
  lightseagreen: "#20b2aa",
  lightskyblue: "#87cefa",
  lightslategray: "#778899",
  lightsteelblue: "#b0c4de",
  lightyellow: "#ffffe0",
  lime: "#00ff00",
  limegreen: "#32cd32",
  linen: "#faf0e6",
  magenta: "#ff00ff",
  maroon: "#800000",
  mediumaquamarine: "#66cdaa",
  mediumblue: "#0000cd",
  mediumorchid: "#ba55d3",
  mediumpurple: "#9370d8",
  mediumseagreen: "#3cb371",
  mediumslateblue: "#7b68ee",
  mediumspringgreen: "#00fa9a",
  mediumturquoise: "#48d1cc",
  mediumvioletred: "#c71585",
  midnightblue: "#191970",
  mintcream: "#f5fffa",
  mistyrose: "#ffe4e1",
  moccasin: "#ffe4b5",
  navajowhite: "#ffdead",
  navy: "#000080",
  oldlace: "#fdf5e6",
  olive: "#808000",
  olivedrab: "#6b8e23",
  orange: "#ffa500",
  orangered: "#ff4500",
  orchid: "#da70d6",
  palegoldenrod: "#eee8aa",
  palegreen: "#98fb98",
  paleturquoise: "#afeeee",
  palevioletred: "#d87093",
  papayawhip: "#ffefd5",
  peachpuff: "#ffdab9",
  peru: "#cd853f",
  pink: "#ffc0cb",
  plum: "#dda0dd",
  powderblue: "#b0e0e6",
  purple: "#800080",
  rebeccapurple: "#663399",
  red: "#ff0000",
  rosybrown: "#bc8f8f",
  royalblue: "#4169e1",
  saddlebrown: "#8b4513",
  salmon: "#fa8072",
  sandybrown: "#f4a460",
  seagreen: "#2e8b57",
  seashell: "#fff5ee",
  sienna: "#a0522d",
  silver: "#c0c0c0",
  skyblue: "#87ceeb",
  slateblue: "#6a5acd",
  slategray: "#708090",
  snow: "#fffafa",
  springgreen: "#00ff7f",
  steelblue: "#4682b4",
  tan: "#d2b48c",
  teal: "#008080",
  thistle: "#d8bfd8",
  tomato: "#ff6347",
  turquoise: "#40e0d0",
  violet: "#ee82ee",
  wheat: "#f5deb3",
  white: "#ffffff",
  whitesmoke: "#f5f5f5",
  yellow: "#ffff00",
  yellowgreen: "#9acd32"
};

// src/ui.ts
class UI {
  colors = new UIColors;
  display(elements) {
    const labels = [];
    const boundingBoxes = [];
    const rawBoxes = [];
    for (let i = 0;i < elements.length; i++) {
      const element = elements[i];
      const rect = element.getBoundingClientRect();
      const div = document.createElement("div");
      div.style.left = `${rect.left}px`;
      div.style.top = `${rect.top}px`;
      div.style.width = `${rect.width}px`;
      div.style.height = `${rect.height}px`;
      div.classList.add("SoM");
      if (element.isContentEditable || EDITABLE_SELECTORS.some((selector) => element.matches(selector))) {
        div.classList.add("editable");
      }
      const surroundingColors = boundingBoxes.filter((box) => {
        const distances = [
          Math.sqrt(Math.pow(rect.left - box.left, 2) + Math.pow(rect.top - box.top, 2)),
          Math.sqrt(Math.pow(rect.right - box.right, 2) + Math.pow(rect.top - box.top, 2)),
          Math.sqrt(Math.pow(rect.left - box.left, 2) + Math.pow(rect.bottom - box.bottom, 2)),
          Math.sqrt(Math.pow(rect.right - box.right, 2) + Math.pow(rect.bottom - box.bottom, 2))
        ];
        return distances.some((distance) => distance < SURROUNDING_RADIUS);
      }).map((box) => box.color);
      const color = this.colors.contrastColor(element, surroundingColors);
      div.style.setProperty("--SoM-color", `${color.r}, ${color.g}, ${color.b}`);
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
      label.style.color = this.getColorByLuminance(box.color);
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
            if (existing.top <= box.top && existing.bottom >= box.bottom && existing.left <= box.left && existing.right >= box.right) {
              return;
            }
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
  getColorByLuminance(color) {
    return color.luminance() > 0.5 ? "black" : "white";
  }
}

// src/style.css
var style_default = ".SoM{position:fixed;z-index:2147483646;pointer-events:none;background-color:rgba(var(--SoM-color),.35)}.SoM.editable{background:repeating-linear-gradient(45deg,rgba(var(--SoM-color),.15),rgba(var(--SoM-color),.15) 10px,rgba(var(--SoM-color),.35) 10px,rgba(var(--SoM-color),.35) 20px);outline:2px solid rgba(var(--SoM-color),.7)}.SoM>label{position:absolute;padding:0 3px;font-size:1rem;font-weight:700;line-height:1.2rem;white-space:nowrap;font-family:'Courier New',Courier,monospace;background-color:rgba(var(--SoM-color),.7)}";

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
  const interval = setInterval(() => {
    if (document.head) {
      clearInterval(interval);
      document.head.appendChild(styleElement);
    }
  }, 100);
}
window.SoM = new SoM;
window.SoM.log("Ready!");
