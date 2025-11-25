# Authentication Flows Documentation

Complete guide to authentication flows in the SaaS School Management System API.

## Table of Contents

- [Overview](#overview)
- [Authentication Methods](#authentication-methods)
- [Flow Diagrams](#flow-diagrams)
- [Step-by-Step Guides](#step-by-step-guides)
- [Token Management](#token-management)
- [Error Handling](#error-handling)
- [Security Best Practices](#security-best-practices)

---

## Overview

The API uses JWT (JSON Web Tokens) for authentication. All protected endpoints require a valid access token in the `Authorization` header. The system supports:

- **Password-based authentication** (email + password)
- **Multi-tenant isolation** (tenant ID required)
- **Token refresh mechanism** (access tokens expire, refresh tokens are long-lived)
- **Role-based access control** (RBAC)

---

## Authentication Methods

### 1. Login Flow

**Endpoint:** `POST /auth/login`

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "password123",
  "tenantId": "tenant-uuid"  // Optional if tenantName provided
  // OR
  "tenantName": "school-slug"  // Optional if tenantId provided
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "admin@example.com",
    "role": "admin",
    "status": "active",
    "tenantId": "tenant-uuid"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid credentials
- `422 Unprocessable Entity` - Validation error (missing fields)
- `429 Too Many Requests` - Rate limit exceeded

### 2. Registration Flow

**Endpoint:** `POST /auth/signup`

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "role": "student",  // student | teacher | admin
  "tenantId": "tenant-uuid",
  "profile": {
    // Role-specific profile data
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Response (201 Created):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "newuser@example.com",
    "role": "student",
    "status": "pending",  // Teachers/students start as pending
    "tenantId": "tenant-uuid"
  }
}
```

**Note:** Teachers and students are created with `status: "pending"` and require admin approval.

### 3. Token Refresh Flow

**Endpoint:** `POST /auth/refresh`

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired refresh token

### 4. Logout Flow

**Endpoint:** `POST /auth/logout`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

---

## Flow Diagrams

### Initial Login Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ 1. POST /auth/login
     │    { email, password, tenantId }
     │
     ▼
┌─────────────┐
│   Backend   │
└────┬────────┘
     │
     │ 2. Validate credentials
     │ 3. Generate tokens
     │
     ▼
┌─────────────┐
│   Response  │
│ { accessToken, │
│   refreshToken, │
│   user }     │
└────┬────────┘
     │
     │ 4. Store tokens
     │
     ▼
┌─────────┐
│ Client  │
│ (Ready) │
└─────────┘
```

### Token Refresh Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ Access token expired
     │
     │ 1. POST /auth/refresh
     │    { refreshToken }
     │
     ▼
┌─────────────┐
│   Backend   │
└────┬────────┘
     │
     │ 2. Validate refresh token
     │ 3. Generate new access token
     │
     ▼
┌─────────────┐
│   Response  │
│ { accessToken } │
└────┬────────┘
     │
     │ 4. Update stored token
     │
     ▼
┌─────────┐
│ Client  │
│ (Ready) │
└─────────┘
```

---

## Step-by-Step Guides

### Complete Authentication Flow (Postman)

1. **Set Collection Variables:**
   - `baseUrl`: `http://localhost:3001`
   - `tenantId`: Your tenant UUID (optional, can be provided in login)

2. **Login:**
   - Use the "Login" request in the Authentication folder
   - The response will automatically set:
     - `accessToken`
     - `refreshToken`
     - `tenantId`

3. **Make Authenticated Requests:**
   - All subsequent requests will use `Bearer {{accessToken}}`
   - Include `x-tenant-id: {{tenantId}}` header for multi-tenant isolation

4. **Refresh Token (when access token expires):**
   - Use the "Refresh Token" request
   - New `accessToken` will be automatically stored

### Frontend Integration Example

```typescript
// Login function
async function login(email: string, password: string, tenantId?: string) {
  const response = await fetch('http://localhost:3001/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, tenantId }),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const data = await response.json();
  
  // Store tokens securely
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('tenantId', data.user.tenantId);
  
  return data.user;
}

// Authenticated request with auto-refresh
async function authenticatedFetch(url: string, options: RequestInit = {}) {
  let accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  const tenantId = localStorage.getItem('tenantId');

  // Try request with current token
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-id': tenantId || '',
      'Content-Type': 'application/json',
    },
  });

  // If token expired, refresh and retry
  if (response.status === 401 && refreshToken) {
    const refreshResponse = await fetch('http://localhost:3001/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshResponse.ok) {
      const { accessToken: newToken } = await refreshResponse.json();
      localStorage.setItem('accessToken', newToken);
      
      // Retry original request
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
          'x-tenant-id': tenantId || '',
          'Content-Type': 'application/json',
        },
      });
    } else {
      // Refresh failed, redirect to login
      localStorage.clear();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  return response;
}
```

---

## Token Management

### Token Expiration

- **Access Token:** 15 minutes (configurable via `JWT_ACCESS_EXPIRY`)
- **Refresh Token:** 7 days (configurable via `JWT_REFRESH_EXPIRY`)

### Token Storage Best Practices

**Frontend:**
- Store tokens in `localStorage` or `sessionStorage` (for web apps)
- Use `httpOnly` cookies if possible (more secure)
- Never store tokens in plain text in code

**Backend:**
- Tokens are stateless (no server-side storage required)
- Refresh tokens can be revoked via logout endpoint

### Token Refresh Strategy

1. **Proactive Refresh:** Refresh token 1-2 minutes before expiration
2. **Reactive Refresh:** Refresh on 401 Unauthorized response
3. **Background Refresh:** Use a background job to refresh tokens periodically

---

## Error Handling

### Common Error Codes

| Status Code | Error Code | Description |
|------------|------------|-------------|
| 401 | `INVALID_CREDENTIALS` | Wrong email/password |
| 401 | `TOKEN_EXPIRED` | Access token expired |
| 401 | `INVALID_TOKEN` | Malformed or invalid token |
| 422 | `MISSING_REQUIRED_FIELDS` | Required fields missing |
| 422 | `VALIDATION_ERROR` | Input validation failed |
| 409 | `DUPLICATE_EMAIL` | Email already registered |
| 404 | `TENANT_NOT_FOUND` | Tenant ID/name not found |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |

### Error Response Format

```json
{
  "error": {
    "message": "Invalid credentials",
    "code": "INVALID_CREDENTIALS",
    "field": "password"  // Optional, for validation errors
  }
}
```

---

## Security Best Practices

### 1. Password Requirements

- Minimum 8 characters
- Mix of uppercase, lowercase, numbers, and special characters
- Never send passwords in query parameters
- Always use HTTPS in production

### 2. Token Security

- Never log tokens
- Don't expose tokens in URLs
- Use HTTPS for all token transmission
- Implement token rotation (refresh tokens)

### 3. Rate Limiting

- Login endpoint: 5 requests/minute
- General API: 100 requests/minute
- Admin actions: 20 requests/minute

### 4. Multi-Tenant Isolation

- Always include `x-tenant-id` header for protected endpoints
- Tenant ID is validated on every request
- Data is automatically scoped to tenant

### 5. Session Management

- Logout invalidates both access and refresh tokens
- Implement session timeout on frontend
- Clear tokens on logout

---

## Testing Authentication

### Using Postman Collection

1. Import `docs/api/postman-collection.json`
2. Set collection variables:
   - `baseUrl`: `http://localhost:3001`
   - `tenantId`: Your tenant UUID
3. Run "Login" request - tokens are automatically saved
4. All other requests will use the saved token

### Using cURL

```bash
# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123",
    "tenantId": "tenant-uuid"
  }'

# Use token in subsequent requests
curl -X GET http://localhost:3001/students \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-tenant-id: tenant-uuid"
```

---

## Additional Resources

- [OpenAPI Specification](./openapi.yaml) - Complete API specification
- [Postman Collection](./postman-collection.json) - Importable API collection
- [API Usage Documentation](../API_USAGE_DOCUMENTATION.md) - Complete endpoint reference

