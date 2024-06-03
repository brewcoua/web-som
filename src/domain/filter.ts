export abstract class Filter {
  abstract apply(elements: HTMLElement[]): Promise<HTMLElement[]>;
}
