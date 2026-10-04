// Settings: the values most likely to be changed. This file loads first, so every other script can use them.

// ---------- sign-in ----------
// Set CREDS to require one specific sign-in, e.g. { user: "name@organization.com", pass: "filing-2026" }.
// Leave as null to accept any valid-looking email and a password of 8 or more characters.
const CREDS = null;

// ---------- limits ----------
const MAX_CASES = 24; // folders the drawer holds across all cabinets, counting the blank "New case file" folder
const MAX_CABINETS = 5;
const MAX_FILES_PER_UPLOAD = 40;
const MAX_NOTES_LENGTH = 2000; // characters in the notes on one piece of evidence

// ---------- cabinets ----------
// The one cabinet a new account starts with.
//   name: shown in the cabinets list      word: the label beside the file count
//   bar: the heading over the open drawer  status: the status given to case files created in it
const FIRST_CABINET = { name: "Active cases", word: "active files", bar: "Active case files", status: "Active" };

// ---------- case files ----------
// Every status a case file can have, with the color of its dot. STATUS_ORDER is the order used by "sort by status".
const STATUS = { Active: "#76190E", "Under review": "#28565D", Closed: "#071516", "Cold case": "#e6eeec" };
const STATUS_ORDER = ["Active", "Under review", "Cold case", "Closed"];
// New case files are numbered upward from here: the first one created is CF-1106.
const CASE_NUMBER_START = 1105;
const FOLDER_COLOR = "#8fbcc1"; // one folder stock for every case file
const FOLDER_INK = "#071516"; // text color on a folder

// ---------- folder tabs ----------
// The pin board is its own screen, so its tab opens that screen instead of a page in the folder.
const TABS = ["Case summary", "Evidence", "Pin board", "Upload documents"],
  T_SUM = 0,
  T_EV = 1,
  T_BOARD = 2,
  T_UP = 3;

// ---------- evidence types ----------
// The types a file can be filed under. These ids are what the review service returns for each uploaded file.
// An id is shown with its underscores as spaces ("witness_statement" -> "Witness statement") unless TYPE_LABEL
// gives it a different label. Types the user adds themselves are kept separately (see state.js).
const FILE_TYPES = [
  "witness_statement",
  "suspect_information",
  "crime_scene_evidence",
  "communication",
  "timeline_event",
  "location_information",
  "web_osint",
  "other",
];
const TYPE_LABEL = { web_osint: "Web OSINT" };
