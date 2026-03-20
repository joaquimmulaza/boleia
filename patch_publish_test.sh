#!/bin/bash
sed -i "s/import { supabase } from '..\/lib\/supabase';/import { supabase } from '..\/lib\/supabase';\nimport { vi } from 'vitest';\nvi.mock('..\/services\/GoogleMapsService', () => ({\n  getPlacePredictions: vi.fn().mockResolvedValue([]),\n  getPlaceDetails: vi.fn().mockResolvedValue({ lat: -8.839, lng: 13.289 }),\n}));/g" src/pages/PublishRoute.test.jsx
