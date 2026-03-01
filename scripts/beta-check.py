"""Quick visual check of beta mode changes"""
import os, sys
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
OUT = os.path.join(os.path.dirname(__file__), "..", "visual-test-screenshots")
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_context(viewport={"width": 1440, "height": 900}).new_page()
    page.set_default_timeout(30000)

    print("1. Landing page (beta badge + hero)")
    page.goto(f"{BASE}", wait_until="load")
    page.wait_for_timeout(2000)
    page.screenshot(path=os.path.join(OUT, "beta-landing.png"))

    print("2. Pricing page (beta free)")
    page.goto(f"{BASE}/pricing", wait_until="load")
    page.wait_for_timeout(2000)
    page.screenshot(path=os.path.join(OUT, "beta-pricing.png"))
    page.screenshot(path=os.path.join(OUT, "beta-pricing-full.png"), full_page=True)

    print("3. Login + dashboard")
    page.goto(f"{BASE}/login", wait_until="load")
    page.wait_for_timeout(500)
    page.get_by_role("button", name="Password").click()
    page.wait_for_timeout(200)
    page.fill('input[type="email"]', 'admin@example.com')
    page.fill('input[type="password"]', 'admin123')
    page.click('button[type="submit"]')
    page.wait_for_timeout(4000)
    page.goto(f"{BASE}/dashboard", wait_until="load")
    page.wait_for_timeout(2000)
    page.screenshot(path=os.path.join(OUT, "beta-dashboard.png"))

    browser.close()
    print("\nDone! Screenshots saved.")
