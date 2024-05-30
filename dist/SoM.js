// src/constants.ts
var SELECTORS = [
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
  '[role="spinbutton"]'
];
var VISIBILITY_RATIO = 0.6;
var ELEMENT_SAMPLING_RATE = 0.1;

// src/filters/visibility.ts
async function filterVisibleElements(elements) {
  const visibleElements = await Promise.all(elements.map(async (element) => {
    if (element.offsetWidth === 0 && element.offsetHeight === 0) {
      return null;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return null;
    }
    let parent = element.parentElement;
    let passed = true;
    while (parent !== null) {
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.display === "none" || parentStyle.visibility === "hidden") {
        passed = false;
        break;
      }
      parent = parent.parentElement;
    }
    if (!passed) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    if (rect.top >= window.innerHeight || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.right <= 0) {
      return null;
    }
    const isVisible = await isElementVisible(element);
    if (!isVisible) {
      return null;
    }
    return element;
  }));
  return visibleElements.filter((element) => element !== null);
}
async function isElementVisible(element) {
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
      const visibleAreaRatio = await calculateVisibleAreaRatio(element, rect);
      resolve(visibleAreaRatio >= VISIBILITY_RATIO);
    });
    observer.observe(element);
  });
}
async function calculateVisibleAreaRatio(element, rect) {
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
  const visiblePos = {
    top: Math.max(0, rect.top),
    left: Math.max(0, rect.left),
    bottom: Math.min(window.innerHeight, rect.bottom),
    right: Math.min(window.innerWidth, rect.right)
  };
  const visibleSize = {
    width: visiblePos.right - visiblePos.left,
    height: visiblePos.bottom - visiblePos.top
  };
  const countVisiblePixels = () => {
    const data = ctx.getImageData(visiblePos.left - rect.left, visiblePos.top - rect.top, visibleSize.width, visibleSize.height).data;
    let visiblePixels2 = 0;
    for (let i = 0;i < data.length; i += 4) {
      if (data[i] > 0) {
        visiblePixels2++;
      }
    }
    return visiblePixels2;
  };
  drawElementOnCanvas(element, ctx, rect, rect, "white");
  const totalPixels = countVisiblePixels();
  const foundElements = await Promise.all(Array.from({ length: Math.ceil(1 / ELEMENT_SAMPLING_RATE) }).map(async (_, i) => {
    const elements2 = document.elementsFromPoint(rect.left + rect.width * ELEMENT_SAMPLING_RATE * i, rect.top + rect.height * ELEMENT_SAMPLING_RATE * i);
    const currentIndex = elements2.indexOf(element);
    return elements2.slice(0, currentIndex);
  }));
  const uniqueElements = Array.from(new Set(foundElements.flat().filter((el) => el !== element)));
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
    drawElementOnCanvas(el, ctx, elRect, rect, "black");
  }));
  const visiblePixels = countVisiblePixels();
  canvas.remove();
  if (totalPixels === 0 || visiblePixels === 0) {
    return 0;
  }
  return visiblePixels / totalPixels;
}
var drawElementOnCanvas = function(element, ctx, rect, baseRect, color = "black") {
  const path = new Path2D;
  const styles = window.getComputedStyle(element);
  const radius = styles.borderRadius?.split(" ").map((r) => parseFloat(r));
  const clipPath = styles.clipPath;
  const offsetRect = {
    top: Math.max(rect.top - baseRect.top, 0),
    bottom: Math.min(rect.bottom - baseRect.top, baseRect.height),
    left: Math.max(rect.left - baseRect.left, 0),
    right: Math.min(rect.right - baseRect.left, baseRect.width),
    width: Math.min(rect.right - baseRect.left, baseRect.width) - Math.max(rect.left - baseRect.left, 0),
    height: Math.min(rect.bottom - baseRect.top, baseRect.height) - Math.max(rect.top - baseRect.top, 0)
  };
  if (radius) {
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
  } else {
    path.rect(offsetRect.left, offsetRect.top, offsetRect.width, offsetRect.height);
  }
  if (clipPath && clipPath !== "none") {
    const clip = new Path2D(clipPath);
    path.addPath(clip);
  }
  ctx.fillStyle = color;
  ctx.fill(path);
};
// src/filters/nesting.ts
async function filterNestedElements(elements) {
  const filteredElements = await Promise.all(elements.map(async (element) => {
    let parent = element.parentElement;
    while (parent !== null) {
      if (elements.includes(parent)) {
        return null;
      }
      parent = parent.parentElement;
    }
    return element;
  }));
  return filteredElements.filter((element) => element !== null);
}
// src/loader.ts
async function loadElements() {
  const preselectedElements = document.querySelectorAll(SELECTORS.join(","));
  const allElements = document.querySelectorAll("*");
  const clickableElements = [];
  for (let i = 0;i < allElements.length; i++) {
    if (window.getComputedStyle(allElements[i]).cursor === "pointer") {
      clickableElements.push(allElements[i]);
    }
  }
  const fullElements = Array.from(preselectedElements).concat(clickableElements).filter((element, index, self) => self.indexOf(element) === index);
  const elements = await filterVisibleElements(fullElements);
  return await filterNestedElements(elements);
}

// src/ui.ts
function displayBoxes(elements) {
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
    div.style.backgroundColor = `rgba(${color.join(",")}, 0.5)`;
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
    label.style.color = colorFromLuminance(box.color);
    label.style.backgroundColor = `rgba(${box.color.join(",")}, 0.7)`;
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
var colorFromLuminance = function(color) {
  const [r, g, b] = color.map((c) => c / 255);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.5 ? "black" : "white";
};

// src/main.ts
class SoM {
  async display() {
    this.clear();
    const elements = await loadElements();
    displayBoxes(elements);
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
}
window.SoM = new SoM;
