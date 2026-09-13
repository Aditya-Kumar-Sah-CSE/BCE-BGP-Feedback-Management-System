# BCE Google Apps Script Connector

This connector enables native Google Form to Google Sheet response destination linking via `FormApp.setDestination()`.

## Background & Architecture

The official Google Forms REST API v1 (`forms.create`, `forms.batchUpdate`) does not expose a REST endpoint to connect a Form's response destination to a Google Sheet.

The BCE Faculty Feedback Management System implements a **Dual-Mode Response Architecture**:
1. **Mode 1 — Native Destination (This Apps Script)**: When deployed and configured, connects the Form directly to the Google Sheet using `FormApp.setDestination(FormApp.DestinationType.SPREADSHEET, sheetId)`. Responses flow automatically from Google Form directly into the Sheet.
2. **Mode 2 — Application-Managed Response Synchronization (Fallback)**: When Apps Script is not deployed, the Next.js server directly uses official Google Forms API v1 (`forms.responses.list`) and Sheets API v4 (`spreadsheets.values.append`) to fetch and record submitted responses with a single click or cron.

---

## 3-Minute Deployment Instructions

1. Go to [https://script.google.com](https://script.google.com) and click **+ New project**.
2. Name the project `BCE Feedback Form Connector`.
3. Replace the contents of `Code.gs` with the code in `google-apps-script/Code.gs`.
4. Click **Deploy** > **New deployment**.
5. Select type: **Web app**.
6. Set:
   - **Description**: `BCE Feedback Linker v1`
   - **Execute as**: `Me (<your google email>)`
   - **Who has access**: `Anyone`
7. Click **Deploy** and authorize permissions when prompted.
8. Copy the generated **Web app URL** (starts with `https://script.google.com/macros/s/.../exec`).
9. Paste into your `.env.local`:
   ```env
   GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/.../exec"
   ```
10. Done! The admin portal will now automatically link generated forms to response sheets natively.
