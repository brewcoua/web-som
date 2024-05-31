import { loadElements } from "./loader";
import { displayBoxes } from "./ui";

class SoM {
  async display() {
    this.clear();

    const elements = await loadElements();
    displayBoxes(elements);
  }

  clear() {
    document.querySelectorAll(".SoM").forEach((element: Element) => {
      element.remove();
    });
    document.querySelectorAll("[data-som]").forEach((element: Element) => {
      element.removeAttribute("data-som");
    });
  }

  hide() {
    document
      .querySelectorAll(".SoM")
      .forEach(
        (element: Element) => ((element as HTMLElement).style.display = "none")
      );
  }

  show() {
    document
      .querySelectorAll(".SoM")
      .forEach(
        (element: Element) => ((element as HTMLElement).style.display = "block")
      );
  }

  resolve(id: number) {
    return document.querySelector(`[data-som="${id}"]`);
  }
}

window.SoM = new SoM();
