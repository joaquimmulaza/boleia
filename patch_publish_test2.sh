#!/bin/bash
sed -i "s/import { vi, describe, it, expect, beforeEach } from 'vitest';/import { describe, it, expect, beforeEach } from 'vitest';/g" src/pages/PublishRoute.test.jsx
