const src = require('fs').readFileSync('src/pages/ProfilPro.jsx', 'utf8');
const lines = src.split('\n');
const gestionWrapper = lines.findIndex(l => l.includes('activeTab === "gestion" && ('));
const pubsTab = lines.findIndex(l => l.includes('Publications Tab Content'));
console.log('Gestion wrapper at line:', gestionWrapper + 1);
console.log('Publications tab at line:', pubsTab + 1);

for (let i = Math.max(0, gestionWrapper - 2); i < Math.min(lines.length, gestionWrapper + 12); i++) {
  console.log((i+1) + ': ' + lines[i]);
}
console.log('---');
// Also print the area around Night Mode in gestion wrapper
const nightModeIdx = lines.findIndex(l => l.includes('Night Mode Toggle'));
console.log('Night Mode at line:', nightModeIdx + 1);
for (let i = Math.max(0, nightModeIdx - 3); i < Math.min(lines.length, nightModeIdx + 5); i++) {
  console.log((i+1) + ': ' + lines[i]);
}
