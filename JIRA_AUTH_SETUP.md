# Jira Authentication Setup with Playwright

This project now includes automatic Jira authentication using Playwright to get session cookies for accessing protected CSV files. Cookies are stored in JSON format similar to Google OAuth tokens.

## Prerequisites

1. **Install Playwright browsers** (run this once after installing dependencies):
   ```bash
   npx playwright install chromium
   ```

2. **Set up environment variables** in your `.env` file:
   ```env
   JIRA_USERNAME=your_jira_username
   JIRA_PASSWORD=your_jira_password
   JIRA_URL=https://jira8.runsystem.info
   CSV_URL=https://jira8.runsystem.info/your-csv-export-url
   ```

## Usage

### Automatic Cookie Retrieval

The system will automatically manage Jira session cookies when you run:
```bash
npm run dev
# or
npm run run-once
```

The system will:
1. Check for cached cookies in `jira-cookie.json`
2. Use cached cookies if they're still valid (24 hours)
3. Automatically get fresh cookies if needed
4. Store new cookies in JSON format

### Manual Cookie Management

Use the cookie CLI tool for manual cookie management:

```bash
# Get cookie (cached or fresh)
npm run cookie get

# Check cookie status
npm run cookie status

# Force refresh cookie
npm run cookie refresh

# Clear cached cookie
npm run cookie clear
```

## How It Works

### CookieManager Class

The `CookieManager` class in `src/cookie-manager.ts` handles:

- **JSON Storage**: Stores cookies in `jira-cookie.json` with metadata
- **Automatic Expiry**: Cookies expire after 24 hours
- **Caching**: Reuses valid cached cookies to avoid re-authentication
- **Fresh Authentication**: Automatically gets new cookies when needed

### Cookie JSON Structure

```json
{
  "cookie_string": "JSESSIONID=ABC123; atlassian.xsrf.token=XYZ789",
  "expires_at": 1703123456789,
  "created_at": 1703037056789,
  "domain": "jira8.runsystem.info"
}
```

### Integration with CSV Fetching

The `fetchCsvText()` function in `src/csv.ts` has been enhanced to:

1. Use `CookieManager` for automatic cookie handling
2. Cache cookies in JSON format
3. Automatically refresh expired cookies
4. Provide seamless authentication

## File Structure

```
project/
├── jira-cookie.json          # Cached Jira session cookies
├── token.json               # Google OAuth tokens
├── src/
│   ├── cookie-manager.ts    # Cookie management system
│   ├── jira-auth.ts        # Jira authentication
│   ├── csv.ts              # CSV fetching with auth
│   └── cookie-cli.ts       # Cookie CLI tool
```

## Troubleshooting

### Common Issues

1. **Login Failed**: 
   - Verify your `JIRA_USERNAME` and `JIRA_PASSWORD` are correct
   - Check if the Jira instance requires additional authentication (2FA, etc.)

2. **Browser Launch Issues**:
   - Ensure Playwright browsers are installed: `npx playwright install chromium`
   - On Linux, you might need additional dependencies

3. **Cookie Issues**:
   - Clear cached cookies: `npm run cookie clear`
   - Force refresh: `npm run cookie refresh`
   - Check status: `npm run cookie status`

### Debug Mode

To see the browser in action (for debugging), modify `src/jira-auth.ts`:

```typescript
this.browser = await chromium.launch({
  headless: false, // Change to false to see the browser
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
```

## Security Notes

- **Credentials**: Never commit your `.env` file to version control
- **Cookies**: Session cookies are stored locally in `jira-cookie.json`
- **Browser**: The headless browser runs locally and doesn't expose credentials
- **Expiry**: Cookies automatically expire after 24 hours for security

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JIRA_USERNAME` | Your Jira username | Yes |
| `JIRA_PASSWORD` | Your Jira password | Yes |
| `JIRA_URL` | Your Jira instance URL | Yes |
| `CSV_URL` | URL to the CSV export | Yes |

## API Reference

### CookieManager

```typescript
class CookieManager {
  async getCookie(): Promise<string>
  async getFreshCookie(): Promise<string>
  async loadCookie(): Promise<string | null>
  async saveCookie(cookieString: string, domain: string): Promise<void>
  clearCookie(): void
  hasValidCookie(): boolean
}
```

### Functions

```typescript
// Get Jira session cookie (cached or fresh)
export async function getJiraCookie(): Promise<string>

// Clear cached cookie
export async function clearJiraCookie(): Promise<void>

// Fetch CSV with automatic authentication
export async function fetchCsvText(): Promise<string>
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `npm run cookie get` | Get cookie (cached or fresh) |
| `npm run cookie status` | Check if valid cached cookie exists |
| `npm run cookie refresh` | Force refresh cookie |
| `npm run cookie clear` | Clear cached cookie |
