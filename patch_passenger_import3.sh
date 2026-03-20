#!/bin/bash
sed -i "s/import { requestSeat } from '..\/services\/AgreementsService';/import { requestSeat } from '..\/services\/AgreementsService';\nimport SearchAddressInput from '..\/components\/SearchAddressInput';\nimport RouteCard from '..\/components\/RouteCard';/g" src/pages/PassengerDashboard.jsx
