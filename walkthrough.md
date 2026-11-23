# Security Summary

Reviewed **13 application files** across the portal (`index.html`, `fee.html`, `letter.html`, `news.html`, `learn.html`, `aihub.html`, `about.html`, `contact.html`, `style.css`, `server.js`, `lib/site-index.js`, `js/site-common.js`, and `js/bseb-assistant.js`). All identified client-side and server-side security issues have been resolved and verified.

### Issues Resolved

| Issue | Affected Files | Fix Applied | Risk Level |
| :--- | :--- | :--- | :--- |
| Script injection from external Google Sheets rows rendered via raw HTML strings and inline click attributes | `letter.html` | Replaced template-string HTML injection and inline click handlers with safe DOM node construction (`textContent`, `createElement`, `addEventListener`), strict `http:`/`https:` URL validation, and sanitized download filenames | High |
| Script injection and `javascript:` URL execution from third-party news feeds | `news.html` | Replaced raw HTML card assembly and inline share handlers with safe DOM creation, strict `https:`/`http:` URL allowlisting (`safeHttpUrl`), and event listeners | High |
| Stored script injection from tampered browser `localStorage` pinned items | `index.html` | Replaced `innerHTML` pin card rendering with DOM element creation (`textContent`) and strict `http:`/`https:` protocol validation on restored pin URLs | Medium |
| Reverse tabnabbing and cross-origin referrer leakage on external links opened in new tabs | `aihub.html`, `index.html`, `fee.html`, `about.html`, `contact.html` | Added `rel="noopener noreferrer"` to all external `target="_blank"` anchors across every page | Medium |
| Missing browser security headers and exposed server technology fingerprint | `server.js` | Disabled `X-Powered-By`, added a tailored `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and `Cross-Origin-Opener-Policy` (while keeping iframe preview compatibility) | Medium |
| Unvalidated AI chat API requests, missing payload size limits, and unverified outbound links in AI replies | `server.js`, `lib/site-index.js` | Enforced `16kb` JSON body limit, per-IP rate limiting (25 requests/minute), strict message/history/language validation, server-side secret handling for `GEMINI_API_KEY`, and a strict site-index allowlist check on every URL returned by the assistant | High |
| Spreadsheet formula injection and unchecked message lengths on contact form submission | `contact.html`, `js/site-common.js` | Added field length limits (`maxlength` + JS validation), neutralized leading formula characters (`=`, `+`, `-`, `@`, tab, CR) before forwarding to Google Sheets, added submit cooldown, and enforced a 10-second request timeout | Medium |
| Unnecessary third-party visitor IP lookup on page load | `index.html` | Removed the background `api.ipify.org` fetch and visitor IP forwarding | Low |
| Exposure of server internals and sensitive workspace files via static file serving | `server.js` | Enforced an explicit blocklist for internal code/config/dotfile paths (`/server.js`, `/package.json`, `/lib/*`, `/walkthrough.md`, `/.env*`) plus canonical `path.resolve` root confinement | High |

### Safeguards Verified

| Safeguard | Scope | Verification |
| :--- | :--- | :--- |
| Zero raw HTML injection on dynamic data | All 8 HTML pages & client JS modules | Codebase scan confirmed zero `innerHTML`, `outerHTML`, `document.write`, `eval`, or inline event handler attributes remain |
| Strict URL protocol validation | `js/site-common.js`, `letter.html`, `news.html`, `index.html`, `js/bseb-assistant.js`, `server.js` | Only `http:` / `https:` (or allowlisted internal paths) are accepted for clickable links; `javascript:` and `data:` schemes are rejected |
| Safe external link navigation | All 8 HTML pages | Codebase scan confirmed every `target="_blank"` link includes `rel="noopener noreferrer"` |
| Server-side AI key isolation | `server.js`, `.env.example` | `GEMINI_API_KEY` is read exclusively from `process.env` on the server; zero secrets appear in any client asset |
| Request validation & abuse throttling | `POST /api/chat` in `server.js` | Oversized, malformed, empty, or overly frequent requests return structured `400` / `413` / `429` responses |
| Path confinement & internal file protection | `server.js` | Requests for `/server.js`, `/package.json`, `/lib/site-index.js`, `/.env.example`, `/walkthrough.md`, and encoded traversal paths return `404` |

---

## PoC Verification

Each patched vulnerability below was traced against a concrete attack payload to confirm the defense holds end-to-end.

### 1. External Google Sheet Script Injection (`letter.html`)
- **Attack Vector (Before)**: A row in the linked Google Sheet containing a memo title like `<img src=x onerror=alert(1)>` or a link containing `javascript:alert(1)` was interpolated directly into `row.innerHTML` and an inline `onclick="downloadPDF('...')"`.
- **Verification (After)**:
  - `renderLetters()` builds every `<tr>` and `<td>` via `document.createElement` and assigns all spreadsheet strings strictly through `.textContent`.
  - Any HTML tags in a spreadsheet cell render harmlessly as literal plain text.
  - Links are checked with `window.BSEBCommon.safeHttpUrl(rawLink, false)`, rejecting `javascript:` or malformed URLs before creating an anchor or trigger.

### 2. Third-Party News Feed `javascript:` URL & Event Injection (`news.html`)
- **Attack Vector (Before)**: A malicious article title containing `');alert(1);//` broke out of the inline `onclick="shareArticle('...')"`, and a `javascript:alert(1)` article URL passed `encodeURI()` untouched into `href`.
- **Verification (After)**:
  - `renderCards()` creates card elements purely via DOM APIs (`textContent`) and attaches share behavior through `addEventListener('click', ...)`, eliminating string-escaped inline handlers.
  - `safeHttpUrl(article.url, false)` validates `new URL(raw).protocol` against `https:` / `http:`, discarding non-web schemes.

### 3. Tampered `localStorage` Pinned Link Injection (`index.html`)
- **Attack Vector (Before)**: A tampered `bseb-hub-pins` value in `localStorage` such as `[{"href":"javascript:alert(1)","title":"<svg onload=alert(1)>","emoji":"🔗"}]` was injected via `a.innerHTML = ...` and `a.href = p.href`.
- **Verification (After)**:
  - `getPins()` filters every stored entry through `safeUrl(p.href)`, discarding `javascript:` links immediately.
  - `refreshPinnedBar()` populates `emojiSpan.textContent` and `titleSpan.textContent` safely without parsing HTML.

### 4. Reverse Tabnabbing on External Directory Links (`aihub.html`, `index.html`, `fee.html`, `about.html`, `contact.html`)
- **Attack Vector (Before)**: 46 links in `aihub.html` and links across other pages used `target="_blank"` without `rel="noopener noreferrer"`, allowing opened third-party tabs to access `window.opener` or receive full referrer headers.
- **Verification (After)**:
  - Automated scan across all `*.html` files returned zero `target="_blank"` links lacking `rel="noopener noreferrer"`.

### 5. Contact Form Spreadsheet Formula Injection (`contact.html`)
- **Attack Vector (Before)**: Submitting `=HYPERLINK("https://evil.example","Click")` in the Name or Message field forwarded an unescaped formula string directly to the backing Google Sheet.
- **Verification (After)**:
  - `window.BSEBCommon.neutralizeSpreadsheetFormula()` detects leading `=`, `+`, `-`, `@`, `\t`, or `\r` characters and prepends a single quote (`'`), ensuring spreadsheet software treats the cell as inert text.
  - Field lengths are bounded (`name <= 80`, `email <= 120`, `subject <= 150`, `message <= 1500`) and rapid repeat submissions are blocked by a 15-second cooldown.

### 6. Server Internal File Exposure & Path Traversal (`server.js`)
- **Attack Vector (Before / Potential)**: Direct requests to `/server.js`, `/lib/site-index.js`, `/package.json`, `/.env.example`, `/walkthrough.md`, or `/..%2fpackage.json`.
- **Verification (After)**:
  - `server.js` checks a normalized blocklist and dotfile rule before resolving any file, and verifies `resolvedPath.startsWith(ROOT_DIR + path.sep)`.
  - Verified live via HTTP `curl` tests returning `404` on all blocked and traversal paths while returning `200` with hardened security headers on all public routes.

### 7. AI Chatbot Input Validation & Link Grounding (`server.js`, `lib/site-index.js`, `js/bseb-assistant.js`)
- **Attack Vector**: Sending empty messages, oversized (>600 char) payloads, oversized JSON bodies (>16 KB), or attempting prompt injection to force the bot to output phishing URLs.
- **Verification (After)**:
  - Empty or >600-character messages are rejected with HTTP `400`; payloads >16 KB are rejected with HTTP `413`; bursts over 25 requests/minute per IP return HTTP `429`.
  - Every URL in the model's structured JSON response is validated against `siteIndex.isAllowedLink(url)` (which only permits verified `bsebwala.in` page routes and indexed portal URLs). Unrecognized or non-HTTP URLs are stripped before the response reaches the browser, and the widget renders all text via `textContent`.
