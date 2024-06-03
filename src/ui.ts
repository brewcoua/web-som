import { EDITABLE_SELECTORS } from "./constants";

type SimpleDOMRect = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
};

export default class UI {
  display(elements: HTMLElement[]) {
    const labels: SimpleDOMRect[] = [];
    const boundingBoxes: (SimpleDOMRect & {
      color: [number, number, number];
    })[] = [];
    const rawBoxes: HTMLElement[] = [];

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

      // If the element is editable, add additional class
      if (
        element.isContentEditable ||
        EDITABLE_SELECTORS.some((selector) =>
          element.matches(selector as string)
        )
      ) {
        div.classList.add("editable");
      }

      const color: [number, number, number] = [
        randomColor(),
        randomColor(),
        randomColor(),
      ];

      // Set color as variable to be used in CSS
      div.style.setProperty(
        "--SoM-color",
        `${color[0]}, ${color[1]}, ${color[2]}`
      );

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

      rawBoxes.push(div);
    }

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const box = boundingBoxes[i];

      const label = document.createElement("label");
      label.textContent = `${i}`;
      label.style.color = this.colorFromLuminance(box.color);

      rawBoxes[i].appendChild(label);

      const labelRect = label.getBoundingClientRect();

      const gridSize = 10;
      const positions: {
        top: number;
        left: number;
      }[] = [];
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
        right: bestPosition.left + labelRect.width,
        bottom: bestPosition.top + labelRect.height,
        width: labelRect.width,
        height: labelRect.height,
      });

      element.setAttribute("data-SoM", `${i}`);
    }
  }

  colorFromLuminance(color) {
    const [r, g, b] = color.map((c) => c / 255.0);
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 0.5 ? "black" : "white";
  }
}
