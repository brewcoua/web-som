# `@brewcoua/web-som`

A Set-of-Marks script for web grounding, suitable for web agent automation.
When using this script, the web page should not have any animations or dynamic content that could interfere with the
script's operation. Additionally, since the script uses quite a few promises, it is recommended to avoid using too little
resources, as it could lead to a deadlock.

## Usage

Include the script in your web page (`SoM.js` or `SoM.min.js`), and then call the `display` method on the `SoM` object in the `window` object.

### Example

```js
(async () => {
	await window.SoM.display();
	console.log('Set-of-Marks displayed');
	const mark = window.SoM.resolve(4); // Resolve the fourth mark (with label '4')
	mark.click(); // Click the mark
})();
```

### How it works

This is a step-by-step guide on how the script works:

#### 1. Elements loading

The script will first query all elements on the page (and inside shadow roots) that fit specific selectors (e.g. `a`, `button`, `input`, etc., see [src/constants.ts](src/constants.ts)). After that, it will go through all elements on the page and find the elements that display a pointer cursor. These elements will be stored in a list of elements that can be clicked, but are less likely to be right than the previously queried elements.

#### 2. Elements filtering

The script will then first proceed to filter out, in both lists, the elements that are not visible enough (see [src/constants.ts](src/constants.ts) for the threshold values, e.g. `0.7`). To do that, we first use an [Intersection Observer](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) to check if the element is visible enough in the viewport, and if it is, we find the elements that are possibly intersecting with the element, using a QuadTree that we previously built with all elements on the page by their bounding boxes. We then query the QuadTree for elements that are possibly intersecting with the element, and we draw them on a canvas, after drawing the original element. We then calculate the pixel-by-pixel visibility ratio by counting the number of pixels that were not overlapped by other elements. If the ratio is above the threshold, we consider the element visible enough.

After that, we take the elements in the second list (the ones that display a pointer cursor) and apply a nesting filter. This filter will remove all elements that are either inside a prioritized element (e.g. a button) or that have too many clickable children. Additionally, we consider elements disjoint if their size is different enough (see [src/constants.ts](src/constants.ts) for the threshold value, e.g. `0.7`).
When applying this filter, we also consider the first list for reference, while not removing any element from that first list afterwards.

#### 3. Elements rendering

Finally, we proceed to render the boxes over the elements that passed the filters. We first render all the boxes, for which we calculate a contrasted color based on the element's background color and all surrounding boxes' colors (we also apply a min/max luminance and minimum saturation). After that, we render labels for the boxes, while calculating the label position that would overlap the least with other labels and boxes, while ignoring any box that fully overlaps that label's box (since some buttons may be completely inside cards, for example). If an element is editable, the box will have a stripped pattern, along with a border to make it more visible.
All boxes ignore pointer events, so the user can still interact with the page.

## License

This project is licensed under either of the following, at your option:

- Apache License, Version 2.0, ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT License ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you,
as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.
