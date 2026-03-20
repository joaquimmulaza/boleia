const fs = require('fs');
let content = fs.readFileSync('src/pages/PublishRoute.test.jsx', 'utf8');

content = content.replace(
  `    const mockInsert = vi.fn().mockReturnValue({\n      select: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }),\n    });\n      select: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),\n    });`,
  `    const mockInsert = vi.fn().mockReturnValue({\n      select: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),\n    });`
);

fs.writeFileSync('src/pages/PublishRoute.test.jsx', content);
