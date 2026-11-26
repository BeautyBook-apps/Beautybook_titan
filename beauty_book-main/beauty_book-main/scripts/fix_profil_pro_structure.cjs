const fs = require('fs');
const path = 'src/pages/ProfilPro.jsx';
let src = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// Step 1: Remove the bad gestion wrapper injection (lines added previously)
// The wrapper starts with this comment + conditional:
const BAD_WRAPPER_START = `\n        {/* Ma Gestion Content — only when activeTab === "gestion" */}\n      {activeTab === "gestion" && (\n        <div className="px-5 pb-4 space-y-4">\n\n        {/* Night Mode Toggle */}`;
const CLEAN_NIGHT_MODE = `\n\n        {/* Night Mode Toggle */}`;

if (src.includes(BAD_WRAPPER_START)) {
  src = src.replace(BAD_WRAPPER_START, CLEAN_NIGHT_MODE);
  console.log('✅ Removed bad gestion wrapper start');
} else {
  console.log('⚠️  Bad wrapper start not found — trying line-by-line removal');
  const lines = src.split('\n');
  const idx = lines.findIndex(l => l.includes('Ma Gestion Content — only when'));
  if (idx !== -1) {
    // Remove lines: idx (comment), idx+1 (activeTab conditional), idx+2 (<div>), idx+3 (blank)
    lines.splice(idx, 4);
    src = lines.join('\n');
    console.log('✅ Removed 4 bad lines starting at line', idx+1);
  }
}

// Step 2: Remove the closing }) of the bad wrapper (before the logout section)
// The logout button now has an extra </div> and )} wrapping it
// Find: `        </div>\n      )}\n    </div>` and replace with just `    </div>`
const BAD_WRAPPER_END = `        </div>\n      )}\n    </div>\n  );\n}`;
const CLEAN_END = `    </div>\n  );\n}`;

if (src.includes(BAD_WRAPPER_END)) {
  src = src.replace(BAD_WRAPPER_END, CLEAN_END);
  console.log('✅ Removed bad gestion wrapper end');
} else {
  console.log('⚠️  Bad wrapper end not found');
}

// Step 3: Fix the Stats Cards div — change display:none approach to proper conditional
const OLD_STATS_HIDDEN = `      {/* Stats Cards */}\n      <div className="px-5 pt-4 space-y-4" style={{ display: activeTab !== "gestion" ? "none" : undefined }}>`;
const NEW_STATS_CONDITIONAL_OPEN = `      {/* Stats Cards + Gestion — only shown for Ma Gestion tab */}\n      {activeTab === "gestion" && (\n      <div className="px-5 pt-4 space-y-4">`;

if (src.includes(OLD_STATS_HIDDEN)) {
  src = src.replace(OLD_STATS_HIDDEN, NEW_STATS_CONDITIONAL_OPEN);
  console.log('✅ Stats Cards section converted to conditional render');
} else {
  console.log('⚠️  Stats hidden style not found');
}

// Step 4: Close the new conditional before the publications tab
// The Stats section ends with the closing </div> of "px-5 pt-4"
// Find the pattern just before the publications tab comment
const BEFORE_PUBS = `      {/* ── Publications Tab Content`;
const STATS_CLOSE_PATTERN = `\n      )}\n\n      {/* ── Publications Tab Content`;
// We need to close the {activeTab === "gestion" && ( added in step 3
// Find the last </div> before the publications comment and add )}
const lines2 = src.split('\n');
const pubsIdx = lines2.findIndex(l => l.includes('Publications Tab Content'));
if (pubsIdx !== -1) {
  // The line before the publications comment should be blank or the closing div
  // Insert    )} before the publications comment
  if (!lines2[pubsIdx - 2].includes(')}')) {
    lines2.splice(pubsIdx, 0, '      )}');
    src = lines2.join('\n');
    console.log('✅ Inserted )} to close gestion conditional before publications tab');
  } else {
    console.log('ℹ️  Closing )} already present before publications tab');
  }
}

fs.writeFileSync(path, src, 'utf8');
console.log('✅ File saved');

// Verify brace count
const open = (src.match(/\{/g) || []).length;
const close = (src.match(/\}/g) || []).length;
console.log('Braces: open=' + open + ' close=' + close + ' diff=' + (open - close));
console.log('Total lines:', src.split('\n').length);
