#!/bin/bash
sed -i "s/const mockInsert = vi.fn().mockReturnValue({/const mockInsert = vi.fn().mockReturnValue({\n      select: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }),\n    });/g" src/pages/PublishRoute.test.jsx
