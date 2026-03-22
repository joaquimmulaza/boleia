const fs = require('fs');
let code = fs.readFileSync('src/pages/PassengerDashboard.jsx', 'utf8');

code = code.replace(/const mapInstance = useRef\(null\);/, 'const [mapInstance, setMapInstance] = useState(null);');
code = code.replace(/mapInstance\.current = map;/g, 'setMapInstance(map);');
code = code.replace(/mapInstance\.current\.remove\(\);/g, 'if (mapInstance) { mapInstance.remove(); }');
code = code.replace(/if \(!mapInstance\.current \|\| !true\) return;/g, 'if (!mapInstance) return;');
code = code.replace(/mapInstance\.current/g, 'mapInstance');

code = code.replace(/const \[true, setMapLoaded\] = useState\(false\);/, '');
code = code.replace(/map\.on\("load", \(\) => setMapLoaded\(true\)\);/, '');
code = code.replace(/}, \[rotas, true\]\);/g, '}, [rotas, mapInstance]);');

fs.writeFileSync('src/pages/PassengerDashboard.jsx', code);
