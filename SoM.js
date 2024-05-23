const SELECTORS = [
    'button',
    'a',
    'input',
    'select',
    'textarea',
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
]

class SoM {
    constructor() {
        this.elements = [];
        this.boxes = [];
    }

    colorFromLuminance(color) {
        const [r, g, b] = color.map(c => c / 255.0);
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        return luminance > 0.5 ? 'black' : 'white';
    }

    async loadElements() {
        // First, select all elements that are clickable by default, then add the ones that have an onClick event
        let elements = document.querySelectorAll(SELECTORS.join(','));
        let onclickElements = Array.from(
            document.querySelectorAll('*')
        ).filter(element => element.onclick !== null ||
            // Check if the style for cursor is pointer
            window.getComputedStyle(element).cursor === 'pointer'
        );

        // Then, filter elements that are not visible, either because of style or because the window needs to be scrolled
        elements = (await Promise.all(Array.from(elements)
            .concat(onclickElements)
            .map(async (element, index) => {
                if (element.offsetWidth === 0 && element.offsetHeight === 0) {
                    return false;
                }
                const style = window.getComputedStyle(element);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                    return false;
                }

                // Check if any of the element's parents are hidden
                let parent = element.parentElement;
                while (parent !== null) {
                    const parentStyle = window.getComputedStyle(parent);
                    if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden' || parentStyle.opacity === '0') {
                        return false;
                    }
                    parent = parent.parentElement;
                }

                // Check if the element is in the viewport
                const rect = element.getBoundingClientRect();
                if (rect.top >= window.innerHeight || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.right <= 0) {
                    return false;
                }

                // Finally, check if it isn't behind another element by checking all corners
                const corners = [
                    {x: rect.left + 1, y: rect.top + 1},
                    {x: rect.right - 1, y: rect.top + 1},
                    {x: rect.left + 1, y: rect.bottom - 1},
                    {x: rect.right - 1, y: rect.bottom - 1}
                ];
                if (corners.some(corner => {
                    const el = document.elementFromPoint(corner.x, corner.y);
                    return el !== null && el !== element;
                })) {
                    return false;
                }

                return element;
            })))
            .filter((element, index, self) => element && self.indexOf(element) === index);

        // Now, filter elements so that we only keep the ones that are not inside another clickable element
        elements = elements.filter(element => {
            let parent = element.parentElement;
            while (parent !== null) {
                if (elements.includes(parent)) {
                    return false;
                }
                parent = parent.parentElement;
            }
            return true
        });

        return elements;
    }

    async display() {
        this.clear();

        const elements = await this.loadElements();

        const labels = [];
        const boundingBoxes = [];

        this.elements.push(...elements);

        const randomColor = () => Math.floor(Math.random() * 256);

        // First, define the bounding boxes
        elements.forEach((element, index) => {
            const rect = element.getBoundingClientRect();
            const div = document.createElement('div');
            div.style.left = `${rect.left}px`;
            div.style.top = `${rect.top}px`;
            div.style.width = `${rect.width}px`;
            div.style.height = `${rect.height}px`;
            div.classList.add('SoM');

            const color = [randomColor(), randomColor(), randomColor()]
            div.style.backgroundColor = `rgba(${color.join(',')}, 0.5)`;

            document.body.appendChild(div);

            boundingBoxes.push({
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height,
                color: color
            });

            this.boxes.push(div);
        });


        elements.forEach((element, index) => {
            const box = boundingBoxes[index];

            const label = document.createElement('label');
            label.textContent = index;
            label.style.color = this.colorFromLuminance(box.color);
            label.style.backgroundColor = `rgba(${box.color.join(',')}, 0.7)`;

            this.boxes[index].appendChild(label);

            const labelRect = label.getBoundingClientRect();

            const gridSize = 10;
            const positions = [];
            for (let i = 0; i <= gridSize; i++) {
                // Top side
                positions.push({
                    top: box.top - labelRect.height,
                    left: box.left + (box.width / gridSize) * i - labelRect.width / 2
                });
                // Bottom side
                positions.push({top: box.bottom, left: box.left + (box.width / gridSize) * i - labelRect.width / 2});
                // Left side
                positions.push({
                    top: box.top + (box.height / gridSize) * i - labelRect.height / 2,
                    left: box.left - labelRect.width
                });
                // Right side
                positions.push({top: box.top + (box.height / gridSize) * i - labelRect.height / 2, left: box.right});
            }

            // Calculate score for each position
            const scores = positions.map(position => {
                let score = 0;

                // Check if position is within bounds
                if (position.top < 0 || position.top + labelRect.height > window.innerHeight ||
                    position.left < 0 || position.left + labelRect.width > window.innerWidth) {
                    score += Infinity; // Out of bounds, set score to infinity
                } else {
                    // Calculate overlap with other labels and bounding boxes
                    labels.concat(boundingBoxes).forEach(existing => {
                        const overlapWidth = Math.max(0, Math.min(position.left + labelRect.width, existing.left + existing.width) - Math.max(position.left, existing.left));
                        const overlapHeight = Math.max(0, Math.min(position.top + labelRect.height, existing.top + existing.height) - Math.max(position.top, existing.top));
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
                height: labelRect.height
            });

            element.setAttribute('data-SoM', index);
        });
    }

    hide() {
        this.boxes.forEach(label => label.style.display = 'none');
    }

    clear() {
        this.elements.forEach(element => element.removeAttribute('data-SoM'));
        this.elements.length = 0;

        this.boxes.forEach(label => label.remove());
        this.boxes.length = 0;
    }
}

window.SoM = new SoM();