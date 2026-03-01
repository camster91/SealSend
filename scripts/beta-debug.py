"""Debug beta mode client errors"""
import os, sys
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_context(viewport={"width": 1440, "height": 900}).new_page()
    page.set_default_timeout(30000)
    
    errors = []
    page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error", "warning") else None)
    page.on("pageerror", lambda err: errors.append(f"[PAGE ERROR] {err}"))
    
    print("Loading pricing page...")
    page.goto(f"{BASE}/pricing", wait_until="load")
    page.wait_for_timeout(3000)
    
    print("\nConsole errors:")
    for e in errors:
        print(f"  {e}")
    
    if not errors:
        print("  (none)")
    
    browser.close()
