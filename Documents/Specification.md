# Paper Miniature Maker Specification

## 1. Overview
The purpose of this application is to create paper miniatures for Dungeons and Dragons. This is a common requirement for dungeon masters and can be very difficult and time-consuming. 

## 2. Technical Architecture
* **Desktop Application:** Deployable to Windows, macOS, and Linux.
* **Framework:** Wails (Packages the React UI and Go backend into a native, lightweight executable).
* **Frontend:** React UI.
* **Backend:** Go.
* **Database:** SQLite (Embedded local database, requiring no external server installation).

## 3. UI/UX & Styling
* **Accessibility:** The UI must be WCAG AAA compliant.
* **Theming:** The application should offer a Light and Dark theme toggle.
* **Canvas:** The page background representing the physical print medium should be white.

## 4. Core Features & Mechanics

### 4.1 Project Management
* **Save/Load:** Users can save their current workspace to a project file (e.g., `.pmm`) and open it later to continue editing.
* **Export:** The user can export all pages to a single PDF document for printing. The PDF generation must guarantee absolute, accurate real-world sizing of the miniature boxes regardless of printer DPI settings.

### 4.2 Creature Boxes
* **Sizing:** Users can add a creature to the page by selecting its size category:
  * Small: 20mm wide
  * Medium: 25mm wide
  * Large: 50mm wide
  * Huge: 75mm wide
  * Gargantuan: 100mm wide
* **Orientation:** Users can flip the orientation of the creature box between horizontal and vertical. When horizontal, the box becomes wider than it is tall.
* **Physical Assembly (Top-Fold):** 
  * The reverse of the paper miniature is automatically created by mirroring the image left-to-right.
  * The back half of the miniature is inverted (upside down) on the layout so that when physically folded at the top, both sides are right-side up.
  * Cut lines (solid) and fold lines (dashed) are automatically generated to guide the user during physical assembly.
  * The application includes base tabs at the bottom of both sides for insertion into physical miniature stands.
* **Labels & Numbering:**
  * Users can add a custom name to the monster box.
  * The creature box is automatically numbered. 
  * Text (name and number) must be readable (not backward) on both the front and the back of the physical miniature.
  * Adding a brand new creature box resets its number to 1.
  * Duplicating an existing creature box increments the number by 1 from the original.
* **Deletion:** Users can delete any monster box on the page.

### 4.3 Image Management
* Users can copy an image from the internet and paste it directly into the creature box.
* Users can also open an image from their local machine.
* Inside the box, the user can adjust the pasted image using the following controls:
  * Pan Up, Down, Left, Right
  * Zoom In, Zoom Out
  * Rotate Left, Rotate Right

### 4.4 Auto-Arrangement & Layouting
* **2D Bin Packing:** When a new monster box is added or duplicated, the application automatically positions it to maximize the use of page space.
* **Auto-Rotation:** The application is allowed to auto-rotate the monster box on the 2D layout to achieve the best page fit.
* **Strict Bounds:** The application must never place monster boxes off the page.
* **Pagination:** If there is no room left on a page, the application automatically starts a new page and places the monster box there.

## 5. Development & Deployment
* **Source Control:** The application will be under source control using GitHub.
* **Continuous Integration (CI):** Any push or pull request to the `master` branch must automatically trigger:
  * Build
  * Unit tests
  * UI tests
  * Linting
* **Release:** A GitHub Action will be manually triggered to create a GitHub Release containing the deployable executables for Windows, Mac, and Linux.
