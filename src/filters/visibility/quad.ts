export class Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  element: HTMLElement | null;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    element: HTMLElement | null = null
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.element = element;
  }

  contains(rect: Rectangle): boolean {
    return (
      rect.x >= this.x &&
      rect.x + rect.width <= this.x + this.width &&
      rect.y >= this.y &&
      rect.y + rect.height <= this.y + this.height
    );
  }

  intersects(rect: Rectangle): boolean {
    return !(
      rect.x > this.x + this.width ||
      rect.x + rect.width < this.x ||
      rect.y > this.y + this.height ||
      rect.y + rect.height < this.y
    );
  }
}

export default class QuadTree {
  boundary: Rectangle;
  capacity: number;
  elements: Rectangle[];
  divided: boolean;
  northeast: QuadTree | null;
  northwest: QuadTree | null;
  southeast: QuadTree | null;
  southwest: QuadTree | null;

  constructor(boundary: Rectangle, capacity: number) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.elements = [];
    this.divided = false;
    this.northeast = null;
    this.northwest = null;
    this.southeast = null;
    this.southwest = null;
  }

  subdivide(): void {
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

  insert(element: Rectangle): boolean {
    if (!this.boundary.intersects(element)) {
      return false;
    }

    if (this.elements.length < this.capacity) {
      this.elements.push(element);
      return true;
    } else {
      if (!this.divided) {
        this.subdivide();
      }

      if (this.northeast!.insert(element)) {
        return true;
      } else if (this.northwest!.insert(element)) {
        return true;
      } else if (this.southeast!.insert(element)) {
        return true;
      } else if (this.southwest!.insert(element)) {
        return true;
      }
      return false;
    }
  }

  query(range: Rectangle, found: Rectangle[] = []): Rectangle[] {
    if (!this.boundary.intersects(range)) {
      return found;
    }

    for (let element of this.elements) {
      if (range.intersects(element)) {
        found.push(element);
      }
    }

    if (this.divided) {
      this.northwest!.query(range, found);
      this.northeast!.query(range, found);
      this.southwest!.query(range, found);
      this.southeast!.query(range, found);
    }

    return found;
  }
}
