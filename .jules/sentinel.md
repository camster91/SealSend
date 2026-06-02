## 2026-06-02 - [High] Prevent database information leakage in API routes
**Vulnerability:** API endpoints were returning raw database error messages (`insertError.message`) directly to the client.
**Learning:** Returning raw error objects from the database can expose internal schema details, such as table names, constraints, or even snippets of SQL queries, aiding attackers in reconnaissance.
**Prevention:** Always catch database errors, log them server-side for debugging, and return a sanitized, generic error message to the client.
