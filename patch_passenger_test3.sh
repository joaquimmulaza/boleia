sed -i 's/if (maplibregl.default.Map.mock.*) {/if (maplibregl.default.Map.mock \&\& maplibregl.default.Map.mock.results.length > 0) {/' src/pages/PassengerDashboard.test.jsx
