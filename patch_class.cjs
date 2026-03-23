const fs = require('fs');
let file = fs.readFileSync('src/pages/PassengerDashboard.test.jsx', 'utf8');

const classMock = `vi.mock('maplibre-gl', () => {
  class Map {
    constructor() {
      this.remove = vi.fn();
      this.on = vi.fn();
      this.addControl = vi.fn();
      this.addSource = vi.fn();
      this.addLayer = vi.fn();
      this.getLayer = vi.fn().mockReturnValue(false);
      this.getSource = vi.fn().mockReturnValue(false);
      this.removeLayer = vi.fn();
      this.removeSource = vi.fn();
    }
  }

  class Popup {
    constructor() {
      this.setHTML = vi.fn().mockReturnThis();
      this.addTo = vi.fn().mockReturnThis();
    }
  }

  class Marker {
    constructor() {
      this.setLngLat = vi.fn().mockReturnThis();
      this.setPopup = vi.fn().mockReturnThis();
      this.addTo = vi.fn().mockReturnThis();
      this.remove = vi.fn();
    }
  }

  class GeolocateControl {
    constructor() {}
  }

  return {
    default: {
      Map: vi.fn().mockImplementation(() => new Map()),
      Popup: vi.fn().mockImplementation(() => new Popup()),
      Marker: vi.fn().mockImplementation(() => new Marker()),
      GeolocateControl: vi.fn().mockImplementation(() => new GeolocateControl())
    }
  };
});`;

const lines = file.split('\\n');
let newLines = [];
let i = 0;
while (i < lines.length) {
  if (lines[i].startsWith("vi.mock('maplibre-gl'")) {
    newLines.push(classMock);
    while (i < lines.length && !lines[i].startsWith("// ───────────")) {
      i++;
    }
  }
  if (i < lines.length) {
    newLines.push(lines[i]);
  }
  i++;
}

let result = newLines.join('\\n');
result = result.replace(/expect\(maplibregl\.default\.Marker\)\.toHaveBeenCalled\(\);\n      \}, \{ timeout: 3000 \}\);/,
`expect(maplibregl.default.Marker).toHaveBeenCalled();
      }, { timeout: 3000 });`);

fs.writeFileSync('src/pages/PassengerDashboard.test.jsx', result);
