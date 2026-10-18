import { useState, useEffect } from 'react';
import { 
	Trash2, 
	Copy, 
	Plus, 
	Save, 
	FolderOpen, 
	FileDown, 
	Moon, 
	Sun, 
	RotateCw, 
	RotateCcw, 
	ZoomIn, 
	ZoomOut, 
	ArrowUp, 
	ArrowDown, 
	ArrowLeft, 
	ArrowRight, 
	RefreshCw, 
	BookOpen, 
	FileText
} from 'lucide-react';
import './App.css';
import { 
	SaveProject, 
	LoadProject, 
	SelectLocalImage, 
	SaveToLibrary, 
	GetLibrary, 
	DeleteFromLibrary, 
	GetRecentProjects,
	LoadProjectFromPath 
} from "../wailsjs/go/main/App";
import { 
	Creature, 
	Page, 
	PackedCreature, 
	packCreatures, 
	getCreatureDimensions 
} from './utils/packer';
import { jsPDF } from 'jspdf';

// Structure of recent projects from Go
interface RecentProj {
	id: number;
	name: string;
	filePath: string;
	lastOpened: string;
}

// Structure of library creatures from Go
interface LibraryCreature {
	id: number;
	name: string;
	size: string;
	orientation: string;
	imageData: string;
}

function App() {
	// Project State
	const [creatures, setCreatures] = useState<Creature[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [pageFormat, setPageFormat] = useState<'a4' | 'letter'>('a4');
	const [allowAutoRotation, setAllowAutoRotation] = useState<boolean>(true);
	const [includeCreatureNumber, setIncludeCreatureNumber] = useState<boolean>(true);
	const [theme, setTheme] = useState<'dark' | 'light'>('dark');

	// Create Creature Form State
	const [newName, setNewName] = useState<string>('Goblin');
	const [newSize, setNewSize] = useState<'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan'>('Medium');
	const [newOrientation, setNewOrientation] = useState<'vertical' | 'horizontal'>('vertical');

	// Local Library & Recents Cache
	const [library, setLibrary] = useState<LibraryCreature[]>([]);
	const [recents, setRecents] = useState<RecentProj[]>([]);

	// Loading/Export States
	const [isExporting, setIsExporting] = useState<boolean>(false);
	const [exportProgress, setExportProgress] = useState<string>('');

	// Load DB cache on mount
	useEffect(() => {
		refreshLibraryAndRecents();
		// Global clipboard paste listener
		const handlePaste = (e: ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;
			for (let i = 0; i < items.length; i++) {
				if (items[i].type.indexOf('image') !== -1) {
					const file = items[i].getAsFile();
					if (file && selectedId) {
						const reader = new FileReader();
						reader.onload = (event) => {
							if (event.target?.result) {
								updateSelectedCreature('imageData', event.target.result as string);
							}
						};
						reader.readAsDataURL(file);
					}
				}
			}
		};
		window.addEventListener('paste', handlePaste);
		return () => window.removeEventListener('paste', handlePaste);
	}, [selectedId]);

	const refreshLibraryAndRecents = () => {
		GetLibrary().then(res => setLibrary(res || [])).catch(console.error);
		GetRecentProjects().then(res => setRecents(res || [])).catch(console.error);
	};

	// Theme Toggle
	const toggleTheme = () => {
		const nextTheme = theme === 'dark' ? 'light' : 'dark';
		setTheme(nextTheme);
		if (nextTheme === 'light') {
			document.body.classList.add('light-theme');
		} else {
			document.body.classList.remove('light-theme');
		}
	};

	// Selected Creature
	const selectedCreature = creatures.find(c => c.id === selectedId) || null;

	const updateSelectedCreature = (field: keyof Creature, value: any) => {
		setCreatures(prev => prev.map(c => {
			if (c.id === selectedId) {
				return { ...c, [field]: value };
			}
			return c;
		}));
	};

	// Add Brand New Creature
	const handleAddCreature = () => {
		const newCreature: Creature = {
			id: `creature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: newName,
			number: 1, // Reset to 1 for a brand new creature name
			size: newSize,
			orientation: newOrientation,
			imageData: '',
			panX: 0,
			panY: 0,
			zoom: 1.0,
			rotation: 0
		};
		setCreatures(prev => [...prev, newCreature]);
		setSelectedId(newCreature.id);
	};

	// Duplicate Selected Creature (increment number by 1)
	const handleDuplicateSelected = () => {
		if (!selectedCreature) return;

		// Find highest existing number for this creature name to auto-increment properly
		const existingSameName = creatures.filter(c => c.name.toLowerCase() === selectedCreature.name.toLowerCase());
		const maxNumber = Math.max(...existingSameName.map(c => c.number), 0);

		const duplicate: Creature = {
			...selectedCreature,
			id: `creature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			number: maxNumber + 1, // Increment from max
		};

		setCreatures(prev => [...prev, duplicate]);
		setSelectedId(duplicate.id);
	};

	// Delete Selected Creature
	const handleDeleteSelected = () => {
		if (!selectedId) return;
		setCreatures(prev => prev.filter(c => c.id !== selectedId));
		setSelectedId(null);
	};

	// Keyboard deletion listener
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Delete' || e.key === 'Backspace') {
				// Prevent deletion if the user is typing in form controls
				const target = e.target as HTMLElement;
				if (
					target.tagName === 'INPUT' || 
					target.tagName === 'TEXTAREA' || 
					target.tagName === 'SELECT' || 
					target.isContentEditable
				) {
					return;
				}
				
				if (selectedId) {
					handleDeleteSelected();
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [selectedId]);

	// Select Local Image via Go Backend Dialog
	const handleSelectLocalImage = () => {
		if (!selectedId) return;
		SelectLocalImage().then(dataUrl => {
			if (dataUrl) {
				updateSelectedCreature('imageData', dataUrl);
			}
		}).catch(console.error);
	};

	// Save Selected Creature to SQLite Library
	const handleSaveToLibrary = () => {
		if (!selectedCreature) return;
		SaveToLibrary(
			selectedCreature.name,
			selectedCreature.size,
			selectedCreature.orientation,
			selectedCreature.imageData
		).then(() => {
			refreshLibraryAndRecents();
		}).catch(console.error);
	};

	// Load Creature from Library List
	const handleImportFromLibrary = (libC: LibraryCreature) => {
		// Find highest number of same name currently in workspace
		const existingSameName = creatures.filter(c => c.name.toLowerCase() === libC.name.toLowerCase());
		const maxNumber = Math.max(...existingSameName.map(c => c.number), 0);

		const imported: Creature = {
			id: `creature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: libC.name,
			number: maxNumber + 1,
			size: libC.size as any,
			orientation: libC.orientation as any,
			imageData: libC.imageData,
			panX: 0,
			panY: 0,
			zoom: 1.0,
			rotation: 0
		};
		setCreatures(prev => [...prev, imported]);
		setSelectedId(imported.id);
	};

	// Delete from SQLite Library
	const handleDeleteFromLibrary = (e: React.MouseEvent, id: number) => {
		e.stopPropagation(); // Stop click-through triggering import
		DeleteFromLibrary(id).then(() => {
			refreshLibraryAndRecents();
		}).catch(console.error);
	};

	// Save Project to .pmm JSON
	const handleSaveProject = () => {
		const payload = JSON.stringify({
			creatures,
			pageFormat,
			allowAutoRotation,
			includeCreatureNumber
		});
		SaveProject(payload).then(savedPath => {
			if (savedPath) {
				refreshLibraryAndRecents();
			}
		}).catch(console.error);
	};

	// Load Project from .pmm File Dialog
	const handleLoadProject = () => {
		LoadProject().then(jsonStr => {
			if (jsonStr) {
				try {
					const data = JSON.parse(jsonStr);
					if (Array.isArray(data.creatures)) {
						setCreatures(data.creatures);
					}
					if (data.pageFormat) {
						setPageFormat(data.pageFormat);
					}
					if (data.allowAutoRotation !== undefined) {
						setAllowAutoRotation(data.allowAutoRotation);
					}
					if (data.includeCreatureNumber !== undefined) {
						setIncludeCreatureNumber(data.includeCreatureNumber);
					}
					setSelectedId(null);
					refreshLibraryAndRecents();
				} catch (e) {
					console.error("Invalid project file content:", e);
				}
			}
		}).catch(console.error);
	};

	// Load Project From Direct Path
	const handleLoadProjectFromPath = (path: string) => {
		LoadProjectFromPath(path).then(jsonStr => {
			if (jsonStr) {
				try {
					const data = JSON.parse(jsonStr);
					if (Array.isArray(data.creatures)) {
						setCreatures(data.creatures);
					}
					if (data.pageFormat) {
						setPageFormat(data.pageFormat);
					}
					if (data.allowAutoRotation !== undefined) {
						setAllowAutoRotation(data.allowAutoRotation);
					}
					if (data.includeCreatureNumber !== undefined) {
						setIncludeCreatureNumber(data.includeCreatureNumber);
					}
					setSelectedId(null);
					refreshLibraryAndRecents();
				} catch (e) {
					console.error("Invalid project file content:", e);
				}
			}
		}).catch(console.error);
	};

	// Run Packing Algorithm
	const pages = packCreatures(creatures, pageFormat, allowAutoRotation);

	// Canvas display sizing (standard 210x297 / 215.9x279.4 in mm)
	const pageWidthMm = pageFormat === 'a4' ? 210 : 215.9;
	const pageHeightMm = pageFormat === 'a4' ? 297 : 279.4;

	// High DPI Image Cropper Helper for PDF generation
	const getCroppedImageForPDF = (
		imageData: string,
		widthMm: number,
		heightMm: number,
		panX: number,
		panY: number,
		zoom: number,
		rotation: number,
		isBack: boolean
	): Promise<string> => {
		return new Promise((resolve) => {
			if (!imageData) {
				resolve('');
				return;
			}
			const img = new Image();
			img.onload = () => {
				const scale = 10; // 10px per mm (approx 254 DPI)
				const canvas = document.createElement('canvas');
				const w = widthMm * scale;
				const h = heightMm * scale;
				canvas.width = w;
				canvas.height = h;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					resolve('');
					return;
				}

				// Fill background with solid white to prevent PDF transparent rendering border artifacts
				ctx.fillStyle = '#FFFFFF';
				ctx.fillRect(0, 0, w, h);
				ctx.save();
				ctx.translate(w / 2, h / 2);

				if (isBack) {
					ctx.scale(-1, 1);     // Mirror horizontally
					ctx.rotate(Math.PI);  // Upside down (rotate 180 deg)
				}

				const adjRotation = isBack ? -rotation : rotation;
				ctx.rotate((adjRotation * Math.PI) / 180);
				ctx.scale(zoom, zoom);

				const adjPanX = isBack ? -panX : panX;
				ctx.translate(adjPanX * (scale / 4), panY * (scale / 4)); // scale input offsets

				const imgAspect = img.width / img.height;
				const canvasAspect = w / h;
				let drawW = w;
				let drawH = h;
				if (imgAspect > canvasAspect) {
					drawH = w / imgAspect;
				} else {
					drawW = h * imgAspect;
				}

				ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
				ctx.restore();
				resolve(canvas.toDataURL('image/png'));
			};
			img.onerror = () => resolve('');
			img.src = imageData;
		});
	};

	// Export PDF with Flawless Scale
	const handleExportPDF = async () => {
		if (creatures.length === 0) return;
		setIsExporting(true);
		setExportProgress('Packing sheets...');

		const doc = new jsPDF({
			orientation: 'portrait',
			unit: 'mm',
			format: pageFormat
		});

		try {
			for (let pIdx = 0; pIdx < pages.length; pIdx++) {
				setExportProgress(`Generating page ${pIdx + 1} of ${pages.length}...`);
				if (pIdx > 0) {
					doc.addPage();
				}

				const page = pages[pIdx];

				for (const packed of page.creatures) {
					const c = packed.creature;
					const dims = getCreatureDimensions(c.size, c.orientation);
					
					// Position in PDF (taking 10mm printable margins into account)
					const pdfX = packed.x + 10;
					const pdfY = packed.y + 10;

					// Define coordinate translation map for rotation
					const getPDFPoint = (cx: number, cy: number) => {
						if (!packed.rotated) {
							return { x: pdfX + cx, y: pdfY + cy };
						} else {
							// Rotate 90 degrees clockwise around (pdfX, pdfY)
							return { x: pdfX + (packed.originalHeight - cy), y: pdfY + cx };
						}
					};

					// Render cropped images on physical high-DPI canvas
					const frontImg = await getCroppedImageForPDF(c.imageData, dims.width, dims.faceHeight, c.panX, c.panY, c.zoom, c.rotation, false);
					const backImg = await getCroppedImageForPDF(c.imageData, dims.width, dims.faceHeight, c.panX, c.panY, c.zoom, c.rotation, true);

					// Draw back image if present
					if (backImg) {
						// Back face is at cy = dims.tabHeight to dims.tabHeight + dims.faceHeight
						// When unrotated, we place it. When rotated, we must orient it with correct transformation
						const p1 = getPDFPoint(0, dims.tabHeight);
						
						// In jsPDF, drawing rotated images is easiest using a graphics state or passing the rotation.
						// To avoid complexity, we can use the exact corners of the rectangle to place the cropped image,
						// or simple math with addImage angles!
						if (!packed.rotated) {
							// Round to exact integers to eliminate sub-pixel rendering border artifacts
							doc.addImage(backImg, 'PNG', Math.round(p1.x), Math.round(p1.y), Math.round(dims.width), Math.round(dims.faceHeight));
						} else {
							// Rotated 90 degrees clockwise
							// Unrotated Back image was at x: 0, y: tabHeight.
							// Rotated coordinate of top-left is: pdfX + (totalHeight - (tabHeight + faceHeight)), pdfY
							const rx = pdfX + (dims.height - (dims.tabHeight + dims.faceHeight));
							const ry = pdfY;
							// Round to exact integers to eliminate sub-pixel rendering border artifacts
							doc.addImage(backImg, 'PNG', Math.round(rx), Math.round(ry), Math.round(dims.faceHeight), Math.round(dims.width), undefined, undefined, 90);
						}
					}

					// Draw front image if present
					if (frontImg) {
						// Front face is at cy = dims.tabHeight + dims.faceHeight to dims.tabHeight + 2*dims.faceHeight
						const p1 = getPDFPoint(0, dims.tabHeight + dims.faceHeight);
						if (!packed.rotated) {
							// Round to exact integers to eliminate sub-pixel rendering border artifacts
							doc.addImage(frontImg, 'PNG', Math.round(p1.x), Math.round(p1.y), Math.round(dims.width), Math.round(dims.faceHeight));
						} else {
							// Rotated 90 degrees clockwise
							// Unrotated top-left of front face is at x: 0, y: tabHeight + faceHeight
							const rx = pdfX + (dims.height - (dims.tabHeight + 2*dims.faceHeight));
							const ry = pdfY;
							// Round to exact integers to eliminate sub-pixel rendering border artifacts
							doc.addImage(frontImg, 'PNG', Math.round(rx), Math.round(ry), Math.round(dims.faceHeight), Math.round(dims.width), undefined, undefined, 90);
						}
					}

					// Draw Cut and Fold Lines
					doc.setDrawColor(0, 0, 0); // Solid black
					doc.setLineWidth(0.2);

					// 1. Draw Outer Solid Cut Borders
					const corners = [
						getPDFPoint(0, 0),
						getPDFPoint(dims.width, 0),
						getPDFPoint(dims.width, dims.height),
						getPDFPoint(0, dims.height)
					];
					
					// Draw border lines sequentially
					doc.line(corners[0].x, corners[0].y, corners[1].x, corners[1].y);
					doc.line(corners[1].x, corners[1].y, corners[2].x, corners[2].y);
					doc.line(corners[2].x, corners[2].y, corners[3].x, corners[3].y);
					doc.line(corners[3].x, corners[3].y, corners[0].x, corners[0].y);

					// 2. Draw Fold Lines
					doc.setLineDashPattern([1, 1], 0); // Dashed line pattern
					
					// Tab 1 Fold Line (between back tab and back face)
					const t1f_1 = getPDFPoint(0, dims.tabHeight);
					const t1f_2 = getPDFPoint(dims.width, dims.tabHeight);
					doc.line(t1f_1.x, t1f_1.y, t1f_2.x, t1f_2.y);

					// Tab 2 Fold Line (between front tab and front face)
					const t2f_1 = getPDFPoint(0, dims.tabHeight + dims.faceHeight * 2);
					const t2f_2 = getPDFPoint(dims.width, dims.tabHeight + dims.faceHeight * 2);
					doc.line(t2f_1.x, t2f_1.y, t2f_2.x, t2f_2.y);

					// Central Red Fold Line (separates back face and front face)
					doc.setDrawColor(255, 0, 0); // RED
					doc.setLineWidth(0.3);
					const cf_1 = getPDFPoint(0, dims.tabHeight + dims.faceHeight);
					const cf_2 = getPDFPoint(dims.width, dims.tabHeight + dims.faceHeight);
					doc.line(cf_1.x, cf_1.y, cf_2.x, cf_2.y);

					// Reset Draw Colors
					doc.setDrawColor(0, 0, 0);
					doc.setLineDashPattern([], 0);

					// Draw Labels and Numbers (Readable, not reversed on both sides!)
					doc.setFont('Helvetica', 'bold');
					doc.setFontSize(8);
					doc.setTextColor(0, 0, 0);

					const labelStr = `#${c.number} ${c.name}`;
					const textWidth = doc.getTextWidth(labelStr);

					// Front Base Tab Text: Right-side up
					// Center horizontally and vertically on front base tab
					const frontTextX = dims.width / 2;
					const frontTextY = dims.tabHeight + dims.faceHeight * 2 + (dims.tabHeight / 2);
					const frontPt = getPDFPoint(frontTextX, frontTextY);

					let frontDrawX = frontPt.x;
					let frontDrawY = frontPt.y;
					let frontAngle = 0;

					if (!packed.rotated) {
						frontDrawX = frontPt.x - textWidth / 2;
						frontDrawY = frontPt.y;
						frontAngle = 0;
					} else {
						frontDrawX = frontPt.x;
						frontDrawY = frontPt.y - textWidth / 2;
						frontAngle = 90;
					}
					
					doc.text(labelStr, frontDrawX, frontDrawY, {
						angle: frontAngle,
						baseline: 'middle'
					});

					// Back Base Tab Text: Rotated 180 degrees (upside down on flat, right-side up folded)
					// Center horizontally and vertically on back base tab
					const backTextX = dims.width / 2;
					const backTextY = dims.tabHeight / 2;
					const backPt = getPDFPoint(backTextX, backTextY);

					let backDrawX = backPt.x;
					let backDrawY = backPt.y;
					let backAngle = 180;

					if (!packed.rotated) {
						backDrawX = backPt.x + textWidth / 2;
						backDrawY = backPt.y;
						backAngle = 180;
					} else {
						backDrawX = backPt.x;
						backDrawY = backPt.y + textWidth / 2;
						backAngle = 270;
					}
					
					doc.text(labelStr, backDrawX, backDrawY, {
						angle: backAngle,
						baseline: 'middle'
					});

					// Draw Corner Number Badges if enabled
					if (includeCreatureNumber) {
						doc.setFont('Helvetica', 'bold');
						const numFontSize = c.number > 99 ? 5.5 : 7;
						doc.setFontSize(numFontSize);

						// Cap height for Helvetica Bold is ~0.718 of font size:
						const capHeightMm = (numFontSize * 0.718) / (72 / 25.4);
						const badgeSize = 4.5;
						const badgeOffset = 1.0;
						const numStr = String(c.number);
						const numWidthMm = doc.getTextWidth(numStr);

						// 1. Front Corner Badge: In top-left corner of front face
						const frontBadgeCX = badgeOffset;
						const frontBadgeCY = dims.tabHeight + dims.faceHeight + badgeOffset;
						const frontCenterCX = frontBadgeCX + badgeSize / 2;
						const frontCenterCY = frontBadgeCY + badgeSize / 2;
						const frontCenterPt = getPDFPoint(frontCenterCX, frontCenterCY);

						if (!packed.rotated) {
							const pt = getPDFPoint(frontBadgeCX, frontBadgeCY);
							doc.setFillColor(0, 0, 0);
							doc.rect(pt.x, pt.y, badgeSize, badgeSize, 'F');
							doc.setTextColor(255, 255, 255);
							doc.text(numStr, frontCenterPt.x - numWidthMm / 2, frontCenterPt.y + capHeightMm / 2, {
								angle: 0
							});
						} else {
							const rx = pdfX + (dims.height - (frontBadgeCY + badgeSize));
							const ry = pdfY + frontBadgeCX;
							doc.setFillColor(0, 0, 0);
							doc.rect(rx, ry, badgeSize, badgeSize, 'F');
							doc.setTextColor(255, 255, 255);
							doc.text(numStr, frontCenterPt.x + capHeightMm / 2, frontCenterPt.y + numWidthMm / 2, {
								angle: 90
							});
						}

						// 2. Back Corner Badge: In top-left corner of back face (mirrored along fold line)
						const backBadgeCX = badgeOffset;
						const backBadgeCY = dims.tabHeight + dims.faceHeight - badgeOffset - badgeSize;
						const backCenterCX = backBadgeCX + badgeSize / 2;
						const backCenterCY = backBadgeCY + badgeSize / 2;
						const backCenterPt = getPDFPoint(backCenterCX, backCenterCY);

						if (!packed.rotated) {
							const pt = getPDFPoint(backBadgeCX, backBadgeCY);
							doc.setFillColor(0, 0, 0);
							doc.rect(pt.x, pt.y, badgeSize, badgeSize, 'F');
							doc.setTextColor(255, 255, 255);
							doc.text(numStr, backCenterPt.x + numWidthMm / 2, backCenterPt.y - capHeightMm / 2, {
								angle: 180
							});
						} else {
							const rx = pdfX + (dims.height - (backBadgeCY + badgeSize));
							const ry = pdfY + backBadgeCX;
							doc.setFillColor(0, 0, 0);
							doc.rect(rx, ry, badgeSize, badgeSize, 'F');
							doc.setTextColor(255, 255, 255);
							doc.text(numStr, backCenterPt.x - capHeightMm / 2, backCenterPt.y - numWidthMm / 2, {
								angle: 270
							});
						}

						// Reset fill and text colors
						doc.setFillColor(0, 0, 0);
						doc.setTextColor(0, 0, 0);
					}
				}
			}

			doc.save('PaperMiniMaker-Printout.pdf');
			setExportProgress('PDF Downloaded successfully!');
			setTimeout(() => {
				setIsExporting(false);
				setExportProgress('');
			}, 2000);
		} catch (error) {
			console.error("PDF generation failed:", error);
			setExportProgress('Export failed. Check logs.');
			setTimeout(() => setIsExporting(false), 3000);
		}
	};

	return (
		<div id="App" className={theme === 'light' ? 'light-theme' : ''}>
			{/* Header */}
			<header className="app-header">
				<div className="brand">
					<svg viewBox="0 0 24 24" width="24" height="24" className="accent-glow" style={{ color: 'var(--accent-color)' }} fill="none" xmlns="http://www.w3.org/2000/svg">
						{/* Left Ear */}
						<path d="M4 10L1 11L4 14V10Z" fill="#3A6B2C" stroke="#1B2219" strokeWidth="1.2" strokeLinejoin="round" />
						{/* Right Ear */}
						<path d="M20 10L23 11L20 14V10Z" fill="#3A6B2C" stroke="#1B2219" strokeWidth="1.2" strokeLinejoin="round" />
						
						{/* Head Base */}
						<rect x="4" y="6" width="16" height="14" rx="3" fill="#4E8B3E" stroke="#1B2219" strokeWidth="1.2" />
						
						{/* Hair / Helmet (Orcish Iron Helm) */}
						<path d="M4 9C4 7 6 5 8 5H16C18 5 20 7 20 9V7C20 5.5 18 4 15 4H9C6 4 4 5.5 4 7V9Z" fill="#4A525A" stroke="#1B2219" strokeWidth="1.2" strokeLinejoin="round" />
						<path d="M12 3V6" stroke="#4A525A" strokeWidth="2" strokeLinecap="round" />
						
						{/* Angry Brow Ridge */}
						<path d="M5 9.5H19" stroke="#1B2219" strokeWidth="1.2" />
						<path d="M5 10L9 11.5" stroke="#1B2219" strokeWidth="1.2" strokeLinecap="round" />
						<path d="M19 10L15 11.5" stroke="#1B2219" strokeWidth="1.2" strokeLinecap="round" />
						
						{/* Red Eyes with Yellow Pupils */}
						<rect x="6" y="11" width="3" height="1.5" fill="#E53935" />
						<rect x="15" y="11" width="3" height="1.5" fill="#E53935" />
						<circle cx="7.5" cy="11.75" r="0.5" fill="#FFEB3B" />
						<circle cx="16.5" cy="11.75" r="0.5" fill="#FFEB3B" />
						
						{/* Orc Nose/Snout */}
						<path d="M10 13.5H14V15H10V13.5Z" fill="#3A6B2C" stroke="#1B2219" strokeWidth="0.8" />
						
						{/* Mouth with Tusks */}
						<path d="M7 17H17" stroke="#1B2219" strokeWidth="1.2" strokeLinecap="round" />
						{/* Left Tusk */}
						<path d="M8 17L8.5 15L9.5 17" fill="#FFFFFF" stroke="#1B2219" strokeWidth="0.8" strokeLinejoin="round" />
						{/* Right Tusk */}
						<path d="M16 17L15.5 15L14.5 17" fill="#FFFFFF" stroke="#1B2219" strokeWidth="0.8" strokeLinejoin="round" />
					</svg>
					<h1>Paper Mini Maker</h1>
				</div>
				<div className="header-actions">
					<button className="btn btn-secondary" onClick={handleLoadProject} aria-label="Open Project File">
						<FolderOpen size={16} /> Open Project
					</button>
					<button className="btn btn-secondary" onClick={handleSaveProject} aria-label="Save Project File">
						<Save size={16} /> Save Project
					</button>
					<button className="btn btn-primary" onClick={handleExportPDF} aria-label="Export Layout to PDF">
						<FileDown size={16} /> Export PDF
					</button>
					<button className="btn btn-outline" onClick={toggleTheme} aria-label="Toggle Theme">
						{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
					</button>
				</div>
			</header>

			{/* Left Sidebar: Controls & Library */}
			<aside className="sidebar left-sidebar">
				<div className="sidebar-section">
					<h2>Print Preferences</h2>
					<div className="form-group">
						<label htmlFor="pageFormat">Page Size</label>
						<select 
							id="pageFormat" 
							className="form-control"
							value={pageFormat}
							onChange={(e) => setPageFormat(e.target.value as 'a4' | 'letter')}
						>
							<option value="a4">A4 (210 x 297 mm)</option>
							<option value="letter">Letter (215.9 x 279.4 mm)</option>
						</select>
					</div>

				</div>

				<div className="sidebar-section">
					<h2>Creature Library</h2>
					<div className="library-list">
						{library.length === 0 ? (
							<div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
								Library is empty. Save custom creatures here!
							</div>
						) : (
							library.map(libC => (
								<div 
									key={libC.id} 
									className="library-item"
									onClick={() => handleImportFromLibrary(libC)}
								>
									<div className="library-info">
										<span className="library-name">{libC.name}</span>
										<span className="library-meta">{libC.size} | {libC.orientation}</span>
									</div>
									<button 
										className="btn-danger" 
										style={{ padding: '4px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
										onClick={(e) => handleDeleteFromLibrary(e, libC.id)}
										aria-label={`Delete ${libC.name} from Library`}
									>
										<Trash2 size={12} />
									</button>
								</div>
							))
						)}
					</div>
				</div>

				<div className="sidebar-section">
					<h2>Recent Projects</h2>
					<div className="recent-list">
						{recents.length === 0 ? (
							<div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
								No recent projects loaded.
							</div>
						) : (
							recents.map(proj => (
								<div 
									key={proj.id} 
									className="recent-item"
									onClick={() => handleLoadProjectFromPath(proj.filePath)}
								>
									<div className="recent-title">{proj.name}</div>
									<div className="recent-path">{proj.filePath}</div>
								</div>
							))
						)}
					</div>
				</div>
			</aside>

			{/* Center: Printing Canvas Sheet */}
			<main className="canvas-container">
				{isExporting && (
					<div 
						style={{
							backgroundColor: 'var(--bg-sidebar)',
							padding: '16px 24px',
							borderRadius: '8px',
							border: '1px solid var(--border-color)',
							marginBottom: '20px',
							textAlign: 'center',
							fontWeight: 'bold',
							display: 'flex',
							alignItems: 'center',
							gap: '12px',
							boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
						}}
					>
						<RefreshCw className="rotate-infinite" size={20} style={{ color: 'var(--accent-color)' }} />
						<span>{exportProgress}</span>
					</div>
				)}

				{creatures.length === 0 ? (
					<div className="empty-canvas">
						<FileText size={48} />
						<h3>No creatures in project yet</h3>
						<p style={{ maxWidth: '240px', fontSize: '13px' }}>
							Use the right sidebar to design and add custom creature boxes to the printable workspace!
						</p>
					</div>
				) : (
					pages.map((page, pIdx) => (
						<div 
							key={page.id} 
							className="page-sheet"
							style={{
								width: `${pageWidthMm}mm`,
								height: `${pageHeightMm}mm`,
								padding: '10mm',
							}}
						>
							<div className="page-badge">Sheet {pIdx + 1}</div>
							
							{/* 10mm Printable Boundaries Helper */}
							<div 
								className="printable-boundary"
								style={{
									width: `${pageWidthMm - 20}mm`,
									height: `${pageHeightMm - 20}mm`
								}}
							/>

							{/* Absolutely Packed Creatures */}
							{page.creatures.map(packed => {
								const c = packed.creature;
								const isSelected = selectedId === c.id;
								const dims = getCreatureDimensions(c.size, c.orientation);

								// Base offsets and scaling inside card
								const backPanX = -c.panX;
								const backPanY = c.panY;
								const backRotation = -c.rotation;

								return (
									<div 
										key={c.id}
										className={`miniature-box ${isSelected ? 'selected' : ''}`}
										onClick={(e) => {
											e.stopPropagation();
											setSelectedId(c.id);
										}}
										style={{
											position: 'absolute',
											left: `${packed.x + 10}mm`,
											top: `${packed.y + 10}mm`,
											width: `${packed.width}mm`,
											height: `${packed.height}mm`,
											transform: packed.rotated ? 'rotate(90deg)' : 'none',
											transformOrigin: 'top left',
											// When rotated 90deg, the elements are rotated around top-left.
											// We must translate them by the original unrotated height to make them sit correctly in the grid cell
											translate: packed.rotated ? `${packed.height}mm 0mm` : '0mm 0mm',
											display: 'flex',
											flexDirection: 'column',
											boxSizing: 'border-box'
										}}
									>
										{/* Back Base Tab */}
										<div 
											style={{
												height: `${dims.tabHeight}mm`,
												width: `${dims.width}mm`,
												border: '1px dashed #777',
												borderBottom: '1px solid black',
												background: '#fafafa',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												fontSize: '8px',
												color: 'black',
												fontWeight: 'bold',
												boxSizing: 'border-box',
												overflow: 'hidden',
												padding: '0 2px'
											}}
										>
											<span style={{ transform: 'rotate(180deg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '100%', textAlign: 'center' }}>
												#{c.number} {c.name}
											</span>
										</div>

										{/* Back Face */}
										<div 
											style={{
												height: `${dims.faceHeight}mm`,
												width: `${dims.width}mm`,
												borderLeft: '1px solid black',
												borderRight: '1px solid black',
												position: 'relative',
												overflow: 'hidden',
												boxSizing: 'border-box',
												background: 'white'
											}}
										>
											{c.imageData ? (
												<img 
													src={c.imageData} 
													alt="" 
													style={{
														position: 'absolute',
														left: '50%',
														top: '50%',
														width: '100%',
														height: '100%',
														objectFit: 'contain',
														transform: `translate(-50%, -50%) translate(${backPanX}px, ${backPanY}px) scale(${c.zoom}) rotate(${backRotation}deg) scaleX(-1) rotate(180deg)`,
														transformOrigin: 'center center'
													}}
												/>
											) : (
												<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: '10px', transform: 'rotate(180deg)' }}>
													(Paste/Upload Image)
												</div>
											)}
											{includeCreatureNumber && (
												<div 
													style={{
														position: 'absolute',
														bottom: '1mm',
														left: '1mm',
														width: '4.5mm',
														height: '4.5mm',
														backgroundColor: 'black',
														color: 'white',
														fontSize: c.number > 99 ? '6px' : '8px',
														fontWeight: 'bold',
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														textAlign: 'center',
														lineHeight: 1,
														transform: 'rotate(180deg)',
														zIndex: 4,
														pointerEvents: 'none',
														boxSizing: 'border-box'
													}}
												>
													{c.number}
												</div>
											)}
										</div>

										{/* Top Red Fold Line */}
										<div style={{ height: '0', borderTop: '2px dashed #ff3333', width: `${dims.width}mm`, zIndex: 5 }}></div>

										{/* Front Face */}
										<div 
											style={{
												height: `${dims.faceHeight}mm`,
												width: `${dims.width}mm`,
												borderLeft: '1px solid black',
												borderRight: '1px solid black',
												position: 'relative',
												overflow: 'hidden',
												boxSizing: 'border-box',
												background: 'white'
											}}
										>
											{c.imageData ? (
												<img 
													src={c.imageData} 
													alt="" 
													style={{
														position: 'absolute',
														left: '50%',
														top: '50%',
														width: '100%',
														height: '100%',
														objectFit: 'contain',
														transform: `translate(-50%, -50%) translate(${c.panX}px, ${c.panY}px) scale(${c.zoom}) rotate(${c.rotation}deg)`,
														transformOrigin: 'center center'
													}}
												/>
											) : (
												<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: '10px' }}>
													(Paste/Upload Image)
												</div>
											)}
											{includeCreatureNumber && (
												<div 
													style={{
														position: 'absolute',
														top: '1mm',
														left: '1mm',
														width: '4.5mm',
														height: '4.5mm',
														backgroundColor: 'black',
														color: 'white',
														fontSize: c.number > 99 ? '6px' : '8px',
														fontWeight: 'bold',
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														textAlign: 'center',
														lineHeight: 1,
														zIndex: 4,
														pointerEvents: 'none',
														boxSizing: 'border-box'
													}}
												>
													{c.number}
												</div>
											)}
										</div>

										{/* Front Base Tab */}
										<div 
											style={{
												height: `${dims.tabHeight}mm`,
												width: `${dims.width}mm`,
												border: '1px dashed #777',
												borderTop: '1px solid black',
												background: '#fafafa',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												fontSize: '8px',
												color: 'black',
												fontWeight: 'bold',
												boxSizing: 'border-box',
												overflow: 'hidden',
												padding: '0 2px'
											}}
										>
											<span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '100%', textAlign: 'center' }}>
												#{c.number} {c.name}
											</span>
										</div>
									</div>
								);
							})}
						</div>
					))
				)}
			</main>

			{/* Right Sidebar: Properties & Manipulator */}
			<aside className="sidebar right-sidebar">
				<div className="sidebar-section">
					<h2>Template Settings</h2>
					<div className="setting-row" style={{ borderBottom: 'none', padding: '4px 0' }}>
						<span className="setting-label">Include creature number</span>
						<label className="toggle-switch" title="Toggle corner creature numbering">
							<input 
								type="checkbox" 
								checked={includeCreatureNumber} 
								onChange={(e) => setIncludeCreatureNumber(e.target.checked)} 
							/>
							<span className="toggle-slider"></span>
						</label>
					</div>
				</div>

				<div className="sidebar-section">
					<h2>Add Creature</h2>
					<div className="form-group">
						<label htmlFor="cName">Creature Name</label>
						<input 
							id="cName"
							type="text" 
							className="form-control"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
						/>
					</div>
					<div className="form-group">
						<label htmlFor="cSize">Creature Size</label>
						<select 
							id="cSize"
							className="form-control"
							value={newSize}
							onChange={(e) => setNewSize(e.target.value as any)}
						>
							<option value="Small">Small (20mm wide)</option>
							<option value="Medium">Medium (25mm wide)</option>
							<option value="Large">Large (50mm wide)</option>
							<option value="Huge">Huge (75mm wide)</option>
							<option value="Gargantuan">Gargantuan (100mm wide)</option>
						</select>
					</div>
					<div className="form-group">
						<label htmlFor="cOrient">Orientation</label>
						<select 
							id="cOrient"
							className="form-control"
							value={newOrientation}
							onChange={(e) => setNewOrientation(e.target.value as any)}
						>
							<option value="vertical">Vertical (Taller)</option>
							<option value="horizontal">Horizontal (Wider)</option>
						</select>
					</div>
					<button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAddCreature}>
						<Plus size={16} /> Add Creature
					</button>
				</div>

				<div className="sidebar-section">
					<h2>Creature Properties</h2>
					{!selectedCreature ? (
						<div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px', background: 'var(--bg-card)', borderRadius: '8px' }}>
							Click a creature box on the canvas to edit properties.
						</div>
					) : (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
							<div className="form-group">
								<label htmlFor="editName">Name</label>
								<input 
									id="editName"
									type="text" 
									className="form-control"
									value={selectedCreature.name}
									onChange={(e) => updateSelectedCreature('name', e.target.value)}
								/>
							</div>
							<div className="form-group">
								<label htmlFor="editNum">Box Number</label>
								<input 
									id="editNum"
									type="number" 
									className="form-control"
									value={selectedCreature.number}
									onChange={(e) => updateSelectedCreature('number', parseInt(e.target.value) || 1)}
								/>
							</div>

							<div className="form-group">
								<label>Image Management</label>
								<button className="btn btn-secondary" style={{ width: '100%', marginBottom: '8px' }} onClick={handleSelectLocalImage}>
									<FolderOpen size={14} /> Load Image File
								</button>
								<div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
									Tip: Copy any image online, select this box, and press <strong>Ctrl+V</strong> to paste!
								</div>
							</div>

							{selectedCreature.imageData && (
								<div className="form-group">
									<label>Positioning Controls</label>
									
									{/* Pan Controls */}
									<div className="control-grid">
										<button 
											className="control-btn" 
											onClick={() => updateSelectedCreature('panX', selectedCreature.panX - 4)}
											aria-label="Pan Left"
										>
											<ArrowLeft />
										</button>
										<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
											<button 
												className="control-btn" 
												onClick={() => updateSelectedCreature('panY', selectedCreature.panY - 4)}
												aria-label="Pan Up"
											>
												<ArrowUp />
											</button>
											<button 
												className="control-btn" 
												onClick={() => updateSelectedCreature('panY', selectedCreature.panY + 4)}
												aria-label="Pan Down"
											>
												<ArrowDown />
											</button>
										</div>
										<button 
											className="control-btn" 
											onClick={() => updateSelectedCreature('panX', selectedCreature.panX + 4)}
											aria-label="Pan Right"
										>
											<ArrowRight />
										</button>
									</div>

									{/* Zoom Controls */}
									<div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
										<button 
											className="btn btn-secondary" 
											style={{ flex: 1, padding: '6px' }}
											onClick={() => updateSelectedCreature('zoom', Math.max(0.1, selectedCreature.zoom - 0.05))}
											aria-label="Zoom Out"
										>
											<ZoomOut size={14} /> Out
										</button>
										<button 
											className="btn btn-secondary" 
											style={{ flex: 1, padding: '6px' }}
											onClick={() => updateSelectedCreature('zoom', selectedCreature.zoom + 0.05)}
											aria-label="Zoom In"
										>
											<ZoomIn size={14} /> In
										</button>
									</div>

									{/* Rotation Controls */}
									<div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
										<button 
											className="btn btn-secondary" 
											style={{ flex: 1, padding: '6px' }}
											onClick={() => updateSelectedCreature('rotation', selectedCreature.rotation - 15)}
											aria-label="Rotate Left"
										>
											<RotateCcw size={14} /> Rotate L
										</button>
										<button 
											className="btn btn-secondary" 
											style={{ flex: 1, padding: '6px' }}
											onClick={() => updateSelectedCreature('rotation', selectedCreature.rotation + 15)}
											aria-label="Rotate Right"
										>
											<RotateCw size={14} /> Rotate R
										</button>
									</div>

									<button 
										className="btn btn-outline" 
										style={{ width: '100%', fontSize: '11px', padding: '6px' }}
										onClick={() => {
											updateSelectedCreature('panX', 0);
											updateSelectedCreature('panY', 0);
											updateSelectedCreature('zoom', 1.0);
											updateSelectedCreature('rotation', 0);
										}}
									>
										Reset Adjustments
									</button>
								</div>
							)}

							<div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
								<button 
									className="btn btn-secondary" 
									style={{ flex: 1 }}
									onClick={handleDuplicateSelected}
									aria-label="Duplicate Creature"
								>
									<Copy size={14} /> Duplicate
								</button>
								<button 
									className="btn btn-danger" 
									style={{ flex: 1 }}
									onClick={handleDeleteSelected}
									aria-label="Delete Creature"
								>
									<Trash2 size={14} /> Delete
								</button>
							</div>

							<button 
								className="btn btn-outline" 
								style={{ width: '100%', marginTop: '4px', gap: '6px', borderStyle: 'dashed' }}
								onClick={handleSaveToLibrary}
								aria-label="Save Creature to Library"
							>
								<BookOpen size={14} /> Save to Library
							</button>
						</div>
					)}
				</div>
			</aside>
		</div>
	);
}

export default App;
