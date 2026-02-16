import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-5">
          {/* Brand */}
          <div className="md:col-span-2">
            <span className="text-xl font-bold">
              <span className="text-foreground">Seal</span>
              <span className="text-brand-600">Send</span>
            </span>
            <p className="mt-3 text-sm text-muted-foreground">
              Create beautiful digital invitations, collect RSVPs, and manage
              your event guests all in one place.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Product</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/how-it-works"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  How It Works
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Use Cases */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Use Cases
            </h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/use-cases/weddings"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Weddings
                </Link>
              </li>
              <li>
                <Link
                  href="/use-cases/baby-showers"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Baby Showers
                </Link>
              </li>
              <li>
                <Link
                  href="/use-cases/birthday-parties"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Birthday Parties
                </Link>
              </li>
              <li>
                <Link
                  href="/use-cases/corporate-events"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Corporate Events
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Support */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Legal</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
            <h3 className="mt-6 text-sm font-semibold text-foreground">
              Support
            </h3>
            <ul className="mt-3 space-y-2">
              <li>
                <span className="text-sm text-muted-foreground">
                  support@sealsend.com
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8">
          <p className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Seal and Send. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
