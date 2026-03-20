#!/bin/bash
sed -i "s/import { describe, it, expect, vi, beforeEach } from 'vitest';/import { describe, it, expect, vi, beforeEach } from 'vitest';\nvi.mock('..\/services\/GoogleMapsService', () => ({\n  getPlacePredictions: vi.fn().mockResolvedValue([]),\n  getPlaceDetails: vi.fn().mockResolvedValue({ lat: -8.839, lng: 13.289 }),\n}));/g" src/pages/PassengerDashboard.test.jsx
