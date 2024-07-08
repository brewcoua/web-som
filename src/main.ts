import Loader from './loader';
import UI from './ui';
// @ts-ignore
import style from './style.css';

class SoM {
	private readonly loader = new Loader();
	private readonly ui = new UI();

	async display() {
		this.log('Displaying...');
		const startTime = performance.now();

		const elements = await this.loader.loadElements();
		this.clear();
		this.ui.display(elements);

		this.log(
			'Done!',
			`Took ${performance.now() - startTime}ms to display ${elements.length} elements.`
		);
	}

	clear() {
		// Remove all children of the wrapper
		const wrapper = document.querySelector('som-wrapper');
		if (wrapper) {
			wrapper.innerHTML = '';
		}

		document.querySelectorAll('[data-som]').forEach((element: Element) => {
			element.removeAttribute('data-som');
		});
	}

	hide() {
		document
			.querySelectorAll('.SoM')
			.forEach(
				(element: Element) => ((element as HTMLElement).style.display = 'none')
			);
	}

	show() {
		document
			.querySelectorAll('.SoM')
			.forEach(
				(element: Element) => ((element as HTMLElement).style.display = 'block')
			);
	}

	resolve(id: number) {
		return document.querySelector(`[data-som="${id}"]`);
	}

	log(...args: any[]) {
		console.log(
			'%cSoM',
			'color: white; background: #007bff; padding: 2px 5px; border-radius: 5px;',
			...args
		);
	}
}

declare global {
	interface Window {
		SoM: SoM;
	}
}

// Load styles
if (!document.getElementById('SoM-styles')) {
	const styleElement = document.createElement('style');
	styleElement.id = 'SoM-styles';
	styleElement.innerHTML = style;
	// Wait until head becomes available
	const interval = setInterval(() => {
		if (document.head) {
			clearInterval(interval);
			document.head.appendChild(styleElement);
		}
	}, 100);
}

window.SoM = new SoM();
window.SoM.log('Ready!');
