#!/bin/bash
sed -i 's/import { requestSeat, getAvailableRoutes } from '\''..\/services\/RouteService'\'';/import { requestSeat, getAvailableRoutes } from '\''..\/services\/RouteService'\'';\nimport SearchAddressInput from '\''..\/components\/SearchAddressInput'\'';/g' src/pages/PassengerDashboard.jsx
