import re

def fix_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    # Add useSearchParams to react-router-dom mock
    content = re.sub(
        r"useNavigate:\s*\(\)\s*=>\s*mockNavigate,",
        "useNavigate: () => mockNavigate,\n  useSearchParams: () => [new URLSearchParams()],",
        content
    )

    with open(file_path, "w") as f:
        f.write(content)

fix_file("src/pages/Auth.test.jsx")
fix_file("src/pages/AuthValidation.test.jsx")
