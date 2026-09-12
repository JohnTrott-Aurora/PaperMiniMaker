export interface Creature {
	id: string;
	name: string;
	number: number;
	size: 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
	orientation: 'vertical' | 'horizontal';
	imageData: string;
	panX: number;     // in pixels
	panY: number;     // in pixels
	zoom: number;     // multiplier, default 1.0
	rotation: number; // degrees, default 0
}

export interface PackedCreature {
	creature: Creature;
	x: number;          // Millimeters from left (within printable area)
	y: number;          // Millimeters from top (within printable area)
	width: number;      // Bounding box width in mm on the page (can be swapped if rotated)
	height: number;     // Bounding box height in mm on the page (can be swapped if rotated)
	originalWidth: number;  // Physical unrotated width
	originalHeight: number; // Physical unrotated height (including tabs)
	rotated: boolean;   // Whether the layout engine rotated this 90 degrees to fit
}

export interface Shelf {
	y: number;
	height: number;
	usedWidth: number;
}

export interface Page {
	id: string;
	creatures: PackedCreature[];
}

// Get the unrotated physical dimensions of a creature in mm (Width and total flat height including tabs)
export function getCreatureDimensions(size: string, orientation: string): { width: number; height: number; faceHeight: number; tabHeight: number } {
	const tabHeight = 8; // 8mm base tab
	let width = 25;
	let faceHeight = 35;

	switch (size) {
		case 'Small':
			width = 20;
			faceHeight = orientation === 'horizontal' ? 15 : 30;
			break;
		case 'Medium':
			width = 25;
			faceHeight = orientation === 'horizontal' ? 20 : 35;
			break;
		case 'Large':
			width = 50;
			faceHeight = orientation === 'horizontal' ? 35 : 60;
			break;
		case 'Huge':
			width = 75;
			faceHeight = orientation === 'horizontal' ? 50 : 85;
			break;
		case 'Gargantuan':
			width = 100;
			faceHeight = orientation === 'horizontal' ? 65 : 110;
			break;
	}

	const height = (faceHeight * 2) + (tabHeight * 2);
	return { width, height, faceHeight, tabHeight };
}

// 2D Bin Packing Algorithm using an optimized shelf-first layout
export function packCreatures(creatures: Creature[], pageFormat: 'a4' | 'letter', allowAutoRotation: boolean): Page[] {
	// Page dimensions in mm (excluding 10mm margin on each side)
	const margin = 10;
	const pageWidth = pageFormat === 'a4' ? 210 : 215.9;
	const pageHeight = pageFormat === 'a4' ? 297 : 279.4;

	const pw = pageWidth - (margin * 2);  // printable width
	const ph = pageHeight - (margin * 2); // printable height

	// Pre-calculate physical sizes and sort by physical height descending (standard Next-Fit Decreasing Height approach)
	const items = creatures.map(c => {
		const dims = getCreatureDimensions(c.size, c.orientation);
		return {
			creature: c,
			w: dims.width,
			h: dims.height,
		};
	});

	// Keep insertion/addition order so that newly added creatures are placed at the end 
	// of the sheet instead of reshuffling the existing layout.
	// items.sort((a, b) => b.h - a.h);

	const pages: Page[] = [];
	const pageShelves: Shelf[][] = []; // Keep track of shelves per page

	items.forEach(item => {
		let placed = false;

		// Dimensions to try (standard only, rotate-to-fit logic removed)
		const options = [
			{ w: item.w, h: item.h, rot: false }
		];

		// Try to place the item in existing pages
		for (let pIdx = 0; pIdx < pages.length; pIdx++) {
			const page = pages[pIdx];
			const shelves = pageShelves[pIdx];

			// Try to fit the item on any of the existing shelves of this page
			for (let sIdx = 0; sIdx < shelves.length; sIdx++) {
				const shelf = shelves[sIdx];

				for (const opt of options) {
					// Can it fit horizontally on this shelf?
					if (pw - shelf.usedWidth >= opt.w && shelf.height >= opt.h) {
						// Yes! Place it here
						page.creatures.push({
							creature: item.creature,
							x: shelf.usedWidth,
							y: shelf.y,
							width: opt.w,
							height: opt.h,
							originalWidth: item.w,
							originalHeight: item.h,
							rotated: opt.rot,
						});
						shelf.usedWidth += opt.w;
						placed = true;
						break;
					}
				}
				if (placed) break;
			}

			if (placed) break;

			// If it didn't fit on existing shelves, can we start a new shelf on this page?
			// Calculate y position for new shelf
			const lastShelf = shelves[shelves.length - 1];
			const newY = lastShelf.y + lastShelf.height;

			for (const opt of options) {
				if (newY + opt.h <= ph && pw >= opt.w) {
					// We can start a new shelf here!
					const newShelf: Shelf = {
						y: newY,
						height: opt.h,
						usedWidth: opt.w,
					};
					shelves.push(newShelf);
					page.creatures.push({
						creature: item.creature,
						x: 0,
						y: newY,
						width: opt.w,
						height: opt.h,
						originalWidth: item.w,
						originalHeight: item.h,
						rotated: opt.rot,
					});
					placed = true;
					break;
				}
			}

			if (placed) break;
		}

		// If still not placed, create a brand new page
		if (!placed) {
			const newPageId = `page-${pages.length + 1}`;
			
			// We try to place it in the best orientation on the new page
			// Prefer normal unrotated unless only rotated fits or we just take the first option that fits
			let selectedOpt = options[0];
			for (const opt of options) {
				if (opt.w <= pw && opt.h <= ph) {
					selectedOpt = opt;
					break;
				}
			}

			const newShelf: Shelf = {
				y: 0,
				height: selectedOpt.h,
				usedWidth: selectedOpt.w,
			};

			pages.push({
				id: newPageId,
				creatures: [{
					creature: item.creature,
					x: 0,
					y: 0,
					width: selectedOpt.w,
					height: selectedOpt.h,
					originalWidth: item.w,
					originalHeight: item.h,
					rotated: selectedOpt.rot,
				}],
			});

			pageShelves.push([newShelf]);
		}
	});

	return pages;
}
