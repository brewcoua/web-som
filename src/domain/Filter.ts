import InteractiveElements from "./InteractiveElements";

export default abstract class Filter {
  abstract apply(elements: InteractiveElements): Promise<InteractiveElements>;
}
