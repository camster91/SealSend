"""
SealSend Visual Test - Full Event Setup Flow
Screenshots the complete user journey: Landing > Login > Dashboard > Create Event > Guests > Customize > Preview > Publish > Send Invites
"""
import os
import sys
import time
import json

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
OUT = os.path.join(os.path.dirname(__file__), "..", "visual-test-screenshots")
os.makedirs(OUT, exist_ok=True)

shot_num = 0

def screenshot(page, name, full_page=False):
    global shot_num
    shot_num += 1
    path = os.path.join(OUT, f"{shot_num:02d}-{name}.png")
    page.screenshot(path=path, full_page=full_page)
    print(f"  📸 {shot_num:02d}-{name}.png")
    return path

def main():
    print("🎬 SealSend Visual Test - Full Event Flow\n")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.set_default_timeout(60000)
        page.set_default_navigation_timeout(60000)

        # ─── 1. Landing Page ────────────────────────────────────────
        print("1️⃣  Landing Page")
        page.goto(BASE, wait_until="load")
        page.wait_for_timeout(1000)
        screenshot(page, "landing-hero")
        screenshot(page, "landing-full", full_page=True)

        # ─── 2. Login Page ──────────────────────────────────────────
        print("2️⃣  Login Page")
        page.goto(f"{BASE}/login", wait_until="load")
        page.wait_for_timeout(500)
        screenshot(page, "login-page")

        # Click on Password method button
        password_btn = page.get_by_role("button", name="Password")
        if password_btn.count() > 0:
            password_btn.click()
            page.wait_for_timeout(300)
            screenshot(page, "login-password-method")

        # Fill in credentials and login
        print("   Logging in with admin credentials...")
        page.fill('input[type="email"]', 'admin@example.com')
        page.fill('input[type="password"]', 'admin123')
        screenshot(page, "login-filled")
        
        page.click('button[type="submit"]')
        page.wait_for_timeout(5000)
        screenshot(page, "login-result")

        # ─── 3. Dashboard ──────────────────────────────────────────
        print("3️⃣  Dashboard")
        page.goto(f"{BASE}/dashboard", wait_until="load")
        page.wait_for_timeout(2000)
        screenshot(page, "dashboard")
        screenshot(page, "dashboard-full", full_page=True)

        # ─── 4. Create New Event ────────────────────────────────────
        print("4️⃣  Create New Event - Step 1: Details")
        page.goto(f"{BASE}/events/new", wait_until="load")
        page.wait_for_timeout(1000)
        screenshot(page, "wizard-step1-empty")

        # Fill event details using exact IDs from StepEventDetails
        page.fill('#title', 'Summer BBQ Party 2026')
        page.wait_for_timeout(200)
        page.fill('#description', 'Join us for an amazing summer BBQ with great food, drinks, and fun activities! Bring your swimsuits and sunscreen.')
        page.fill('#host_name', 'Cameron')
        page.fill('#event_date', '2026-07-15T14:00')
        page.fill('#event_end_date', '2026-07-15T22:00')
        page.fill('#location_name', 'Sunshine Park')
        page.fill('#location_address', '123 Lakeside Drive, Toronto, ON M5V 1A1')
        page.select_option('#dress_code', 'Casual')
        page.fill('#rsvp_deadline', '2026-07-10T23:59')
        
        page.wait_for_timeout(500)
        screenshot(page, "wizard-step1-filled")
        screenshot(page, "wizard-step1-filled-full", full_page=True)

        # ─── Step 2: Design ─────────────────────────────────────────
        print("5️⃣  Create Event - Step 2: Design")
        next_btn = page.locator('button:has-text("Next")')
        if next_btn.count() > 0:
            next_btn.click()
        page.wait_for_timeout(1000)
        screenshot(page, "wizard-step2-design")
        screenshot(page, "wizard-step2-design-full", full_page=True)

        # ─── Step 3: Guests ─────────────────────────────────────────
        print("6️⃣  Create Event - Step 3: Guests")
        next_btn = page.locator('button:has-text("Next")')
        if next_btn.count() > 0:
            next_btn.click()
        page.wait_for_timeout(1000)
        screenshot(page, "wizard-step3-guests-empty")

        # Try adding guests
        name_input = page.locator('input[placeholder*="name" i]').first
        email_input = page.locator('input[placeholder*="email" i]').first
        
        guests_to_add = [
            ("Alice Johnson", "alice@example.com"),
            ("Bob Smith", "bob@example.com"),
            ("Carol Williams", "carol@example.com"),
        ]
        
        for name, email in guests_to_add:
            if name_input.count() > 0 and email_input.count() > 0:
                name_input.fill(name)
                email_input.fill(email)
                add_btn = page.locator('button:has-text("Add")').first
                if add_btn.count() > 0:
                    add_btn.click()
                    page.wait_for_timeout(300)
                    # Re-find inputs after add
                    name_input = page.locator('input[placeholder*="name" i]').first
                    email_input = page.locator('input[placeholder*="email" i]').first
        
        page.wait_for_timeout(500)
        screenshot(page, "wizard-step3-guests-added")

        # ─── Step 4: Customize ──────────────────────────────────────
        print("7️⃣  Create Event - Step 4: Customize")
        next_btn = page.locator('button:has-text("Next")')
        if next_btn.count() > 0:
            next_btn.click()
        page.wait_for_timeout(1000)
        screenshot(page, "wizard-step4-customize")
        screenshot(page, "wizard-step4-customize-full", full_page=True)

        # ─── Step 5: RSVP Fields ────────────────────────────────────
        print("8️⃣  Create Event - Step 5: RSVP Fields")
        next_btn = page.locator('button:has-text("Next")')
        if next_btn.count() > 0:
            next_btn.click()
        page.wait_for_timeout(1000)
        screenshot(page, "wizard-step5-rsvp-fields")
        screenshot(page, "wizard-step5-rsvp-fields-full", full_page=True)

        # ─── Step 6: Preview ────────────────────────────────────────
        print("9️⃣  Create Event - Step 6: Preview")
        next_btn = page.locator('button:has-text("Next")')
        if next_btn.count() > 0:
            next_btn.click()
        page.wait_for_timeout(1000)
        screenshot(page, "wizard-step6-preview")
        screenshot(page, "wizard-step6-preview-full", full_page=True)

        # Submit the event (save as draft)
        print("   Submitting event...")
        save_btn = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Draft")')
        if save_btn.count() > 0:
            save_btn.first.click()
            page.wait_for_timeout(3000)
            page.wait_for_timeout(2000)
            screenshot(page, "event-created")

        # ─── 10. Event Detail Page ──────────────────────────────────
        print("🔟 Event Detail Page")
        current_url = page.url
        screenshot(page, "event-detail")
        screenshot(page, "event-detail-full", full_page=True)

        # Try to publish the event
        publish_btn = page.locator('button:has-text("Publish")')
        if publish_btn.count() > 0:
            print("   Publishing event...")
            publish_btn.click()
            page.wait_for_timeout(2000)
            page.wait_for_timeout(2000)
            screenshot(page, "event-published")

        # ─── 11. Guests Page ────────────────────────────────────────
        print("1️⃣1️⃣ Guests Management")
        guests_link = page.locator('a:has-text("Guests")')
        if guests_link.count() > 0:
            guests_link.first.click()
            page.wait_for_timeout(2000)
            page.wait_for_timeout(2000)
            screenshot(page, "guests-page")
            screenshot(page, "guests-page-full", full_page=True)

        # ─── 12. Responses Page ─────────────────────────────────────
        print("1️⃣2️⃣ Responses Page")
        page.go_back()
        page.wait_for_timeout(1000)
        resp_link = page.locator('a:has-text("Responses")')
        if resp_link.count() > 0:
            resp_link.first.click()
            page.wait_for_timeout(2000)
            page.wait_for_timeout(2000)
            screenshot(page, "responses-page")

        # ─── 13. Public Event Page ──────────────────────────────────
        print("1️⃣3️⃣ Public Event Page")
        # Get the latest event slug
        page.goto(f"{BASE}/dashboard", wait_until="load")
        page.wait_for_timeout(1000)
        
        # Click on the first event
        first_event = page.locator('a[href*="/events/"]').first
        if first_event.count() > 0:
            first_event.click()
            page.wait_for_timeout(2000)
            page.wait_for_timeout(2000)
            
            # Find and visit public link
            public_link = page.locator('a[href*="/e/"]')
            if public_link.count() > 0:
                slug = public_link.first.get_attribute("href")
                if slug:
                    page.goto(f"{BASE}{slug}" if slug.startswith("/") else slug, wait_until="load")
                    page.wait_for_timeout(2000)
                    screenshot(page, "public-event-page")
                    screenshot(page, "public-event-page-full", full_page=True)

        # ─── 14. Existing Published Event ───────────────────────────
        print("1️⃣4️⃣ Published Event (existing)")
        page.goto(f"{BASE}/e/camerons-birthday-bash-78PZHfrH", wait_until="load")
        page.wait_for_timeout(2000)
        screenshot(page, "existing-published-event")
        screenshot(page, "existing-published-event-full", full_page=True)

        # ─── 15. Marketing Pages ────────────────────────────────────
        print("1️⃣5️⃣ Marketing Pages")
        page.goto(f"{BASE}/pricing", wait_until="load")
        page.wait_for_timeout(1000)
        screenshot(page, "pricing-page")
        screenshot(page, "pricing-page-full", full_page=True)

        page.goto(f"{BASE}/how-it-works", wait_until="load")
        page.wait_for_timeout(1000)
        screenshot(page, "how-it-works")

        # ─── 16. Signup Page ────────────────────────────────────────
        print("1️⃣6️⃣ Signup Page")
        page.goto(f"{BASE}/signup", wait_until="load")
        page.wait_for_timeout(500)
        screenshot(page, "signup-page")

        # ─── 17. Settings Page ──────────────────────────────────────
        print("1️⃣7️⃣ Settings Page")
        page.goto(f"{BASE}/settings", wait_until="load")
        page.wait_for_timeout(1000)
        screenshot(page, "settings-page")

        # ─── Done ──────────────────────────────────────────────────
        browser.close()

    print(f"\n✅ Visual test complete! {shot_num} screenshots saved to:")
    print(f"   {os.path.abspath(OUT)}")

if __name__ == "__main__":
    main()
