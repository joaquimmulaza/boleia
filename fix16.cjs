const fs = require('fs');
let file = fs.readFileSync('src/pages/PassengerDashboard.test.jsx', 'utf8');

const lines = file.split('\\n');
let newLines = [];

for (let i = 0; i < lines.length; i++) {
  if (i >= 53 && i <= 70) continue;
  newLines.push(lines[i]);
}

fs.writeFileSync('src/pages/PassengerDashboard.test.jsx', newLines.join('\\n'));
