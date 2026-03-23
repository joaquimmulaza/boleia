const fs = require('fs');
let file = fs.readFileSync('src/pages/PassengerDashboard.jsx', 'utf8');

// Update the cleanup and inner loop to use optional chaining
file = file.replace(/        if \(mapInstance\.getLayer\(routeId\)\) \{\n            mapInstance\.removeLayer\(routeId\);\n        \}\n        if \(mapInstance\.getSource\(routeId\)\) \{\n            mapInstance\.removeSource\(routeId\);\n        \}/g,
`        if (mapInstance?.getLayer?.(routeId)) {
            mapInstance.removeLayer(routeId);
        }
        if (mapInstance?.getSource?.(routeId)) {
            mapInstance.removeSource(routeId);
        }`);

file = file.replace(/        if \(mapInstance && mapInstance\.getLayer\(routeId\)\) \{\n            mapInstance\.removeLayer\(routeId\);\n        \}\n        if \(mapInstance && mapInstance\.getSource\(routeId\)\) \{\n            mapInstance\.removeSource\(routeId\);\n        \}/g,
`        if (mapInstance?.getLayer?.(routeId)) {
            mapInstance.removeLayer(routeId);
        }
        if (mapInstance?.getSource?.(routeId)) {
            mapInstance.removeSource(routeId);
        }`);

fs.writeFileSync('src/pages/PassengerDashboard.jsx', file);
