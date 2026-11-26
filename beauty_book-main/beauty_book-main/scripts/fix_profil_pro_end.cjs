const fs = require('fs');
const path = 'src/pages/ProfilPro.jsx';
let lines = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n').split('\n');

// Step 1: Remove the orphan )} at line 538 (index 537)
// It's the line right after the tab switcher </div></div>
// Find it: should be a line that is exactly "      )}"
// and comes right before the publications tab comment
const pubsCommentIdx = lines.findIndex(l => l.includes('Publications Tab Content'));
console.log('Publications tab comment at line:', pubsCommentIdx + 1);

// Check what's 2 lines before it
console.log('Line before pubs:', lines[pubsCommentIdx - 1]);
console.log('Line before that:', lines[pubsCommentIdx - 2]);

// The orphan )} should be the line immediately before the publications comment
// (after a blank line)
if (lines[pubsCommentIdx - 1].trim() === '' && lines[pubsCommentIdx - 2].trim() === ')}') {
  lines.splice(pubsCommentIdx - 2, 1); // remove the )} line
  console.log('✅ Removed orphan )} before publications tab');
  // pubsCommentIdx is now off by 1, recalculate
} else if (lines[pubsCommentIdx - 1].trim() === ')}') {
  lines.splice(pubsCommentIdx - 1, 1);
  console.log('✅ Removed orphan )} (adjacent) before publications tab');
}

// Step 2: Find the Stats Cards conditional open (which wraps gestion content)
// It opens with: {activeTab === "gestion" && (
// and should close after the logout button's </button>
const gestionCondIdx = lines.findIndex(l => l.includes('activeTab === "gestion" && (') && l.includes('{'));
console.log('Gestion conditional at line:', gestionCondIdx + 1);

// Step 3: Find the logout button close </button> and the page closing </div>
// The structure at the end should be:
//   </button>      ← logout
//   </div>         ← close inner gestion div
//   )}             ← close gestion conditional
//   </div>         ← close outer page div
//   );
// }
// Find the logout button (last </button> that closes logout)
let logoutButtonEndIdx = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes('Se d') || lines[i].includes('connecter')) {
    // found the logout text, the closing </button> should be a few lines after
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      if (lines[j].trim() === '</button>') {
        logoutButtonEndIdx = j;
        break;
      }
    }
    break;
  }
}
console.log('Logout </button> at line:', logoutButtonEndIdx + 1);
console.log('Lines after logout button:');
for (let i = logoutButtonEndIdx; i < Math.min(logoutButtonEndIdx + 6, lines.length); i++) {
  console.log('  ' + (i+1) + ': ' + JSON.stringify(lines[i]));
}

// The end should be:
//   </button>
//   </div>      ← this is the inner gestion wrapper div (px-5 pt-4 space-y-4)
//   )}          ← close the gestion conditional
//   </div>      ← outer page wrapper
//   );
// }

// Fix the ending: after logout </button> we need </div>, )}, </div>, );, }
const correctEnd = [
  '        </button>',
  '      </div>',
  '      )}',
  '    </div>',
  '  );',
  '}'
];

// Remove everything from logoutButtonEndIdx to end and replace with correct ending
if (logoutButtonEndIdx !== -1) {
  lines = lines.slice(0, logoutButtonEndIdx + 1);
  // Check if the last line is the </button> we want
  // Add correct closing
  lines.push('      </div>');
  lines.push('      )}');
  lines.push('    </div>');
  lines.push('  );');
  lines.push('}');
  console.log('✅ Fixed file ending');
}

const result = lines.join('\n');
fs.writeFileSync(path, result, 'utf8');
console.log('✅ File saved');

// Verify with esbuild-lite check using babel parser
const open = (result.match(/\{/g) || []).length;
const close = (result.match(/\}/g) || []).length;
console.log('Braces: open=' + open + ' close=' + close + ' diff=' + (open - close));
console.log('Lines:', lines.length);
console.log('\nLast 10 lines:');
lines.slice(-10).forEach((l, i) => console.log((lines.length - 10 + i + 1) + ': ' + l));
