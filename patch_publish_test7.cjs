const fs = require('fs');
let content = fs.readFileSync('src/pages/PublishRoute.test.jsx', 'utf8');

content = content.replace(
  `    // Mock database insert failure\n    const mockInsert = vi.fn().mockReturnValue({\n      select: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }),\n    });`,
  `    // Mock database insert failure\n    const mockInsert = vi.fn().mockReturnValue({\n      select: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }),\n    });\n    supabase.from.mockReturnValue({ insert: mockInsert });`
);

content = content.replace(
  `      select: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),\n    });\n    supabase.from.mockReturnValue({ insert: mockInsert });`,
  `      select: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),\n    });`
);

fs.writeFileSync('src/pages/PublishRoute.test.jsx', content);
