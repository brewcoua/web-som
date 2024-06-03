// Selectors for preselecting elements to be checked
export const SELECTORS = [
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
  '[role="spinbutton"]',
];

export const EDITABLE_SELECTORS = [
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
  '[contenteditable="true"]',
];

// Required visibility ratio for an element to be considered visible
export const VISIBILITY_RATIO = 0.6;

// Rate at which elements are sampled for elements on point
// e.g. 0.1 => Make a grid and check on every point every 10% of the size of the element
// This is used to make sure that every element that intersects with the element is checked
export const ELEMENT_SAMPLING_RATE = 0.1;
