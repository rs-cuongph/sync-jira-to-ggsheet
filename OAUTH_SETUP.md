# 🔐 Google OAuth2 Setup Guide

Hướng dẫn thiết lập xác thực Google OAuth2 để thay thế Service Account.

## 📋 Prerequisites

1. **Google Cloud Project** với Google Sheets API được bật
2. **OAuth2 Client ID và Client Secret** từ Google Cloud Console
3. **Node.js** và **npm** đã cài đặt

## 🚀 Setup Steps

### 1. Tạo OAuth2 Credentials

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn project của bạn
3. Vào **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client IDs**
5. Chọn **Desktop application** hoặc **Web application**
6. Đặt tên cho client (ví dụ: "Jira Sync App")
7. Copy **Client ID** và **Client Secret**

### 2. Cấu hình Environment Variables

Tạo file `.env` với các thông tin sau:

```bash
# Google OAuth2
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_SHEET_ID=your_google_sheet_id_here

# Optional: Custom redirect URI (default: http://localhost:3000/oauth2callback)
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
```

### 3. Thiết lập OAuth2 Authentication

#### Bước 1: Generate Authorization URL
```bash
npm run setup
```

Lệnh này sẽ hiển thị một URL. Copy và paste vào browser để authorize.

#### Bước 2: Authorize Application
1. Mở URL từ bước 1 trong browser
2. Đăng nhập với tài khoản Google của bạn
3. Chấp nhận quyền truy cập
4. Bạn sẽ được redirect đến một URL với `code` parameter

#### Bước 3: Exchange Code for Tokens
Copy `code` từ URL redirect và chạy:

```bash
npm run auth <your_authorization_code>
```

Ví dụ:
```bash
npm run auth 4/0AfJohXn...
```

### 4. Verify Setup

Sau khi hoàn thành, bạn sẽ thấy:
- File `token.json` được tạo trong thư mục project
- Thông báo "Authentication successful!"

## 🔄 Token Management

### Automatic Token Refresh
- Tokens sẽ tự động được refresh khi hết hạn
- Không cần can thiệp thủ công

### Manual Token Refresh
Nếu cần refresh token thủ công:

```typescript
import { GoogleOAuth2Manager } from "./src/oauth.js";

const manager = new GoogleOAuth2Manager();
await manager.refreshAccessToken();
```

### Token Validation
Kiểm tra token có còn hợp lệ:

```typescript
import { GoogleOAuth2Manager } from "./src/oauth.js";

const manager = new GoogleOAuth2Manager();
const isValid = await manager.validateTokens();
console.log("Tokens valid:", isValid);
```

## 🛡️ Security Best Practices

1. **Không commit `token.json`** vào version control
2. **Thêm `token.json`** vào `.gitignore`
3. **Bảo mật Client Secret** - không chia sẻ công khai
4. **Sử dụng HTTPS** trong production

## 📁 File Structure

```
src/
├── oauth.ts          # OAuth2 manager class
├── auth-cli.ts       # CLI commands
└── sheets.ts         # Updated sheets integration

token.json            # Generated tokens (auto-created)
.env                  # Environment variables
```

## 🚨 Troubleshooting

### "No tokens found"
- Chạy lại `npm run setup` và `npm run auth`
- Kiểm tra file `token.json` có tồn tại

### "Token validation failed"
- Token có thể đã hết hạn
- Chạy `npm run auth` với code mới

### "Invalid client" error
- Kiểm tra `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`
- Đảm bảo OAuth2 client đã được tạo đúng

## 🔄 Migration from Service Account

### Before (Service Account)
```typescript
// Old way with JWT
const doc = new GoogleSpreadsheet(
  process.env.GOOGLE_SHEET_ID!,
  new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    key: process.env.GOOGLE_PRIVATE_KEY!,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
);
```

### After (OAuth2)
```typescript
// New way with OAuth2
const oauthManager = new GoogleOAuth2Manager();
const oauth2Client = await oauthManager.getAuthenticatedClient();

const doc = new GoogleSpreadsheet(
  process.env.GOOGLE_SHEET_ID!,
  oauth2Client
);
```

## ✅ Benefits of OAuth2

1. **User-based authentication** - Sử dụng tài khoản Google cá nhân/công ty
2. **No service account setup** - Không cần tạo và quản lý service account
3. **Automatic token refresh** - Tokens tự động được cập nhật
4. **Better security** - Không cần lưu private key
5. **Easier deployment** - Chỉ cần OAuth2 credentials

## 📞 Support

Nếu gặp vấn đề, kiểm tra:
1. Google Cloud Console logs
2. Environment variables
3. Token file permissions
4. Network connectivity
