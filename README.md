# The Case Cabinet

A front-end prototype of a private evidence archive, presented as a filing cabinet. You sign in on the cabinet drawer, the drawer opens onto a stack of case files, each file opens as a folder, and each folder has a pin board that shows how the people, places and objects in the case are connected.

It is plain HTML, CSS and JavaScript. There is no build step, no framework and no server.

## Run it

Open `index.html` in a browser, or serve the folder with any static server:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

To publish on GitHub Pages: set **Settings → Pages** to deploy from the `docs/` folder on your default branch.
When `index.html`, `css/` or `js/` changes in the root, the `Sync docs for GitHub Pages` workflow automatically mirrors those files into `docs/` so Pages always serves the newest UI.

Quick check after merging a UI change:
1. Open **Actions → Sync docs for GitHub Pages** and confirm the latest run on the default branch succeeded.
2. Open **Settings → Pages** and use the deployment link to open the published site.
3. Hard refresh the page (`Ctrl/Cmd+Shift+R`) and verify the new UI is visible.

## How the code is organized

`index.html` holds the markup for the four screens (the page with the cabinet, the folder, the review screen, the pin board). Each part of the page then has one stylesheet and one or two scripts.

### Scripts (`js/`)

The scripts are ordinary (non-module) scripts. They load in the order below, and each one uses what the ones before it define.

| File | What it holds |
|---|---|
| `config.js` | **Settings.** The fixed sign-in (if any), limits, statuses and their colors, the folder tabs, the evidence types. |
| `sample-data.js` | The four invented cases and their evidence (`CASES`, `EVID`, `XREF`). |
| `util.js` | Small helpers: `esc`, `tidy`, `plural`, `fileSize`, dates, `reducedMotion`. |
| `state.js` | What the page is working with: cabinets, case files, each folder's evidence, the user's own file types, accounts. |
| `backend.js` | **Stand-ins for the server**: `reviewFiles()` and `connections()`. The two functions to replace when a back end exists. |
| `cabinet.js` | The 3D cabinet, its drawer and folders, and the spring that moves the drawer. |
| `sign-in.js` | Signing in, creating an account and locking, on the drawer face. |
| `folder.js` | The folder as a book: its tabs, and opening and closing it. |
| `folder-pages.js` | What is drawn on the folder's two pages: cover, case summary, evidence grid and viewer, notes, the edit form, the uploader. |
| `new-case.js` | Creating a case file. |
| `drawer.js` | The page around the cabinet and the open drawer: the stack of case files, opening one, the sort menu. |
| `cabinet-list.js` | The cabinets list beside the drawer, and switching between cabinets. |
| `pinboard.js` | The pin board: building, laying out and drawing the graph, and the card that shows the evidence. |
| `upload.js` | Choosing files, sending them for review, and the review screen. |
| `main.js` | Start-up. |

### Styles (`css/`)

| File | What it styles |
|---|---|
| `base.css` | Color and font variables, the page shell, header, statement and lock button. |
| `cabinet.css` | The bay the cabinet sits in, the 3D stage, the sign-in panel, and the zoom when unlocking and locking. |
| `drawer.css` | The open drawer: its bars, the case files, the sort menu. |
| `cabinet-list.css` | The cabinets list and the switch animation. |
| `folder.css` | The folder book, its tabs and everything on its pages. |
| `review.css` | The review screen. |
| `pinboard.css` | The pin board. |

Keep the `<link>` order in `index.html`: where two files style the same element, the later one wins.

## Where to change what

| To change… | Look in |
|---|---|
| Colors and fonts | The variables at the top of `css/base.css` |
| The sample cases or their evidence | `js/sample-data.js` |
| Evidence types, or the label of one | `FILE_TYPES` and `TYPE_LABEL` in `js/config.js` |
| Case statuses and their colors | `STATUS` and `STATUS_ORDER` in `js/config.js` |
| How many cases, cabinets or files per upload are allowed | The limits in `js/config.js` |
| The folder's tabs | `TABS` in `js/config.js`, then the matching `draw…` function in `js/folder-pages.js` |
| What a piece of evidence shows, or its edit form | `drawEvidence`, `evEditHTML` and `drawEvidenceEdit` in `js/folder-pages.js` |
| The ways case files can be sorted | `SORTS` in `js/drawer.js` |
| How fast the drawer opens | `K` and `C` in `js/cabinet.js` |
| The words on the sign-in panel | `buildDrawer` in `js/cabinet.js` (markup) and `js/sign-in.js` (messages) |
| Connecting a real back end | `js/backend.js` |

## Short names used in the code

| Name | Meaning |
|---|---|
| `fo` | A folder object (made in `cabinet.js`): one per case file, plus the blank "new case" folder (`isAdd`). |
| `drawer.folders` | Every folder in the drawer. `foldersIn(i)` gives the ones in cabinet `i`. |
| `CM` | Every case file, by title. `CABS` is the list of cabinets; `curCab` is the open one. |
| `SS`, `folderState(fo)` | A folder's working state: its `evidence`, `xrefs`, pin positions, and what is selected. |
| `cur`, `curTab` | The folder that is open, and the tab that is showing. |
| `lp`, `pg` | The folder's left page and right page. |
| `DRAFT` | What has been typed for a case file that is still being created. |
| `Drawer`, `CabinetList`, `PinBoard`, `Upload` | The parts that keep their workings private and offer a few functions, e.g. `Drawer.sync()`, `PinBoard.open(fo)`. |

A piece of evidence looks like this:

```js
{
  id: "E1", type: "witness_statement", date: "4 March 1958", title: "Statement of the housekeeper",
  summary: "What the evidence shows.",            // from the back end, or typed in with Edit
  people: [], places: [], objects: [],            // what the pin board is built from
  notes: "Anything extra the user has written.",  // optional
  file: { name, kind, size, mime }, src: "blob:…", // only for uploaded files
  edited: true                                    // only once changed by hand
}
```

## What you can do in it

- **Sign in or create an account** on the drawer. Any valid-looking email and a password of 8 or more characters is accepted.
- **Browse case files** in the open drawer. Pointing at a file lifts it and shows a summary; clicking opens it.
- **Sort** the files by recently updated, case number, title, case date or status.
- **Add cabinets** from the list beside the drawer, name them, and switch between them.
- **Create a case file** with "New case file". The new folder has one tab, Upload documents: the left page names the case and the right page takes its files. The folder is created when those files have been reviewed and filed, and its other tabs then fill in from them.
- **Open a folder.** It has four tabs: Case summary, Evidence, Pin board and Upload documents. A folder with evidence opens on Case summary; an empty one opens on Upload documents.
- **Browse evidence** on the Evidence tab: a grid of every piece on the left page, and the chosen piece with its analysis on the right. The "Sort by type" dropdown narrows the grid to one type, including types the user added.
- **Add notes to evidence.** Every piece of evidence has a Notes section under its summary for anything extra. Notes are written and changed with the Edit button, and are shown with the evidence on the pin board.
- **Edit evidence.** The Edit button turns a piece's title, type, date, summary, people, places, objects and notes into fields that can be changed or filled in. Saved changes show on the Case summary and the pin board, and a changed summary is marked "Edited by hand".
- **Upload files** from the Upload documents tab (button or drag and drop). Chosen files wait in a list on the page, where more can be added or taken out. **Send for review** sends the whole list; each file comes back with a type, and a review screen lists them so the types can be checked, changed, or replaced with a type of your own before pressing **Go** to file them as evidence.
- **Open the pin board** from the folder's Pin board tab. Click a string to see the evidence behind it, or a pinned item to see everything it connects to. Items can be dragged, and evidence can be added or removed from the **Evidence** button.

## What is not real yet

This is a front end only. Before building on it, note:

- **No back end and no real sign-in.** Nothing is checked against a server. To require one fixed login for a demo, set `CREDS` in `js/config.js`.
- **Almost nothing is saved.** Accounts, cabinets, case files, uploads, notes, edits and board changes live in memory and are lost when the page reloads. The one exception is the user's own file types (see below).
- **The case data is invented.** The four sample cases and all their evidence are placeholder content in `js/sample-data.js`.
- **Uploaded files do not leave the browser, and the review is simulated.** `reviewFiles(files)` in `js/backend.js` stands in for the server: it waits briefly, then guesses each file's type from its name and kind. Replace its body with the real request; it should resolve with `[{ name, type }]` in the same order as the files. Each result may also carry that file's analysis (`summary`, `people`, `places`, `objects`); whatever is returned is shown on the Evidence tab and feeds the pin board. The stand-in returns none, so uploaded files show "Analysis pending". Images, video and audio can be viewed in the Evidence tab; other files are listed by name.
- **The connections graph is computed in the browser.** `connections(evidence, xrefs)` in `js/backend.js` returns `{ nodes, links }`, where each link lists the evidence that supports it. It has the shape a server endpoint would return, so it can be swapped for one.
- **File types.** The eight built-in type ids are in `FILE_TYPES` in `js/config.js`. Types a user adds are saved in the browser's `localStorage`, per account email, so they are offered again next time on that browser only.
- **Evidence details are typed in by hand.** People, places, objects and summaries are not extracted automatically; for uploaded files they stay blank until the user fills them in with Edit or a back end supplies them.

## Fonts and palette

Fonts are loaded from Google Fonts: Playfair Display (headings), DM Sans (text) and DM Mono (labels). The page falls back to system fonts if they cannot load.

The palette is dark teal with a red-oxide accent: `#071516`, `#28565D`, `#2B6E7C`, `#448690` and `#76190E`.

## Browser support

Built and tested in current Chromium at desktop, laptop and phone widths. It uses CSS 3D transforms, individual transform properties (`translate`) and `overflow: clip`, so it needs a recent version of Chrome, Edge, Safari or Firefox. Animations are reduced when the system's reduced-motion setting is on.
