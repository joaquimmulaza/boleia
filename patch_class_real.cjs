const fs = require('fs');
let file = fs.readFileSync('src/pages/PassengerDashboard.test.jsx', 'utf8');

const lines = file.split('\\n');
let newLines = [];
let i = 0;

while(i < lines.length) {
    if(i >= 53 && i <= 70) {
        i++;
        continue;
    }
    newLines.push(lines[i]);
    i++;
}

fs.writeFileSync('src/pages/PassengerDashboard.test.jsx', newLines.join('\\n'));
