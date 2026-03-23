import re

file_path = "src/pages/LandingPage.test.jsx"
with open(file_path, "r") as f:
    content = f.read()

# Add ThemeProvider import
if "ThemeProvider" not in content:
    content = re.sub(
        r"import { render, screen, fireEvent } from '@testing-library/react';",
        "import { render, screen, fireEvent } from '@testing-library/react';\nimport { ThemeProvider } from '../contexts/ThemeContext';",
        content
    )

# Wrap render in ThemeProvider
content = re.sub(
    r"render\(\s*<BrowserRouter>\s*<LandingPage />\s*</BrowserRouter>\s*\);",
    "render(\n      <ThemeProvider>\n        <BrowserRouter>\n          <LandingPage />\n        </BrowserRouter>\n      </ThemeProvider>\n    );",
    content
)

with open(file_path, "w") as f:
    f.write(content)
