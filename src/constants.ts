// Selectors for preselecting elements to be checked
export const SELECTORS = [
	'a:not(:has(img))',
	'a img',
	'button',
	'input:not([type="hidden"])',
	'select',
	'textarea',
	'[tabindex]:not([tabindex="-1"])',
	'[contenteditable="true"]',
	'.btn',
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
	'textarea',
	'[contenteditable="true"]',
];

// Required visibility ratio for an element to be considered visible
export const VISIBILITY_RATIO = 0.6;

// A difference in size and position of less than DISJOINT_THRESHOLD means the elements are joined
export const DISJOINT_THRESHOLD = 0.1;

// Maximum ratio of the screen that an element can cover to be considered visible (to avoid huge ads)
export const MAX_COVER_RATIO = 0.8;

// Size of batch for each promise when processing element visibility
// Lower batch values may increase performance but in some cases, it can block the main thread
export const ELEMENT_BATCH_SIZE = 10;

// Rate at which elements are sampled for elements on point
// e.g. 0.1 => Make a grid and check on every point every 10% of the size of the element
// This is used to make sure that every element that intersects with the element is checked
export const ELEMENT_SAMPLING_RATE = 0.2;

// Radius within which a box is considered surrounding another box
// This is used for generating contrasted colors
export const SURROUNDING_RADIUS = 200;

// Used when finding the right contrasted color for boxes
export const MAX_LUMINANCE = 0.7;
export const MIN_LUMINANCE = 0.25;
export const MIN_SATURATION = 0.3;
