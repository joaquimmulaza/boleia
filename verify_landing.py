from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_selector('text=Sou Passageiro')
    page.screenshot(path='landing_final.png', full_page=True)
    browser.close()
