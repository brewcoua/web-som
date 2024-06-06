import { MAX_LUMINANCE, MIN_LUMINANCE, MIN_SATURATION } from "../constants";

export default class UIColors {
  contrastColor(element: HTMLElement, surroundingColors: Color[]): Color {
    const style = window.getComputedStyle(element);
    const bgColor = Color.fromCSS(style.backgroundColor);

    return this.getBestContrastColor([bgColor, ...surroundingColors]);
  }

  getBestContrastColor(colors: Color[]): Color {
    const complimentaryColors = colors
      .filter((color) => color.a > 0)
      .map((color) => color.complimentary());

    let color: Color;
    // If there are no colors left, generate a random color
    if (complimentaryColors.length === 0) {
      color = new Color(
        Math.floor(Math.random() * 255),
        Math.floor(Math.random() * 255),
        Math.floor(Math.random() * 255)
      );
    } else {
      color = this.getAverageColor(complimentaryColors);
    }

    // Avoid colors that are too dark or too bright by increasing the luminance
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

  getAverageColor(colors: Color[]): Color {
    const r = colors.reduce((acc, color) => acc + color.r, 0) / colors.length;
    const g = colors.reduce((acc, color) => acc + color.g, 0) / colors.length;
    const b = colors.reduce((acc, color) => acc + color.b, 0) / colors.length;

    return new Color(r, g, b);
  }
}

export class Color {
  constructor(
    public readonly r: number,
    public readonly g: number,
    public readonly b: number,
    public readonly a: number = 255
  ) {
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

  public static fromCSS(css: string): Color {
    if (css.startsWith("#")) {
      return Color.fromHex(css);
    }

    if (css.startsWith("rgb")) {
      const rgb = css
        .replace(/rgba?\(/, "")
        .replace(")", "")
        .split(",")
        .map((c) => parseInt(c.trim())) as [number, number, number, number?];

      return new Color(...rgb);
    }

    if (css.startsWith("hsl")) {
      const hsl = css
        .replace(/hsla?\(/, "")
        .replace(")", "")
        .split(",")
        .map((c) => parseFloat(c.trim())) as [number, number, number, number?];

      return Color.fromHSL({ h: hsl[0], s: hsl[1], l: hsl[2] });
    }

    const hex = NamedColors[css.toLowerCase()];
    if (hex) {
      return Color.fromHex(hex);
    }

    throw new Error(`Unknown color format: ${css}`);
  }

  public static fromHex(hex: string): Color {
    hex = hex.replace("#", "");

    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((char) => char + char)
        .join("");
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

  public static fromHSL(hsl: HSL): Color {
    const h = hsl.h;
    const s = hsl.s;
    const l = hsl.l;

    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return new Color(r * 255, g * 255, b * 255);
  }

  public luminance(): number {
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

  public withLuminance(luminance: number): Color {
    // Lower or increase the ratio of each color to match the desired luminance
    // We want to keep the same overall color (i.e. green stays green, red stays red, etc.)
    const l = this.luminance();
    const ratio = luminance / l;

    const r = Math.min(255, this.r * ratio);
    const g = Math.min(255, this.g * ratio);
    const b = Math.min(255, this.b * ratio);

    return new Color(r, g, b, this.a);
  }

  public saturation(): number {
    return this.toHsl().s;
  }

  public withSaturation(saturation: number): Color {
    const hsl = this.toHsl();
    hsl.s = saturation;
    return Color.fromHSL(hsl);
  }

  public contrast(color: Color): number {
    const l1 = this.luminance();
    const l2 = color.luminance();

    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  public complimentary(): Color {
    const hsl = this.toHsl();
    hsl.h = (hsl.h + 0.5) % 1;
    return Color.fromHSL(hsl);
  }

  public toHex(): string {
    const r = this.r.toString(16).padStart(2, "0");
    const g = this.g.toString(16).padStart(2, "0");
    const b = this.b.toString(16).padStart(2, "0");

    if (this.a < 255) {
      const a = this.a.toString(16).padStart(2, "0");
      return `#${r}${g}${b}${a}`;
    }

    return `#${r}${g}${b}`;
  }

  public toHsl(): HSL {
    const r = this.r / 255;
    const g = this.g / 255;
    const b = this.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    let h = (max + min) / 2;
    let s = (max + min) / 2;
    let l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
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

  toString(): string {
    return this.toHex();
  }
}

export type HSL = {
  h: number;
  s: number;
  l: number;
  a?: number;
};

export const NamedColors: Record<string, string> = {
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
  yellowgreen: "#9acd32",
};
