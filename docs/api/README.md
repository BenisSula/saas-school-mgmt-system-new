# API Documentation

Complete API documentation for the SaaS School Management System.

## Files

- **[openapi.yaml](./openapi.yaml)** - OpenAPI 3.0 specification
  - Complete API schema
  - Request/response schemas
  - Authentication details
  - Import into Swagger UI, Postman, or API clients

- **[postman-collection.json](./postman-collection.json)** - Postman Collection v2.1
  - Pre-configured requests
  - Authentication flows
  - Environment variables
  - Test scripts for auto-token management

- **[AUTH_FLOWS.md](./AUTH_FLOWS.md)** - Authentication Flow Documentation
  - Step-by-step authentication guides
  - Token management
  - Security best practices
  - Frontend integration examples

## Quick Start

### 1. Import Postman Collection

1. Open Postman
2. Click **Import**
3. Select `postman-collection.json`
4. Set collection variables:
   - `baseUrl`: `http://localhost:3001`
   - `tenantId`: Your tenant UUID

### 2. Authenticate

1. Run the **Login** request in the Authentication folder
2. Tokens are automatically saved to collection variables
3. All subsequent requests will use the saved token

### 3. Explore API

- Browse organized folders (Authentication, Students, Teachers, Admin, etc.)
- Each request includes example payloads
- Modify requests as needed for your use case

## Base URL

- **Development:** `http://localhost:3001`
- **Production:** `https://api.example.com` (update in collection variables)

## Authentication

All protected endpoints require:

```
Authorization: Bearer <accessToken>
x-tenant-id: <tenantId>
```

See [AUTH_FLOWS.md](./AUTH_FLOWS.md) for complete authentication documentation.

## OpenAPI Specification

The OpenAPI spec can be used with:

- **Swagger UI:** View interactive API documentation
- **Postman:** Import for API testing
- **Code Generation:** Generate client SDKs
- **API Testing Tools:** Import into various testing frameworks

### View in Swagger UI

```bash
# Install swagger-ui-serve
npm install -g swagger-ui-serve

# Serve the OpenAPI spec
swagger-ui-serve docs/api/openapi.yaml
```

Or use online Swagger Editor: https://editor.swagger.io/

## API Structure

### Public Endpoints
- `GET /health` - Health check
- `GET /schools` - List public schools
- `POST /auth/login` - Login
- `POST /auth/signup` - Register
- `POST /auth/refresh` - Refresh token

### Protected Endpoints (Require Authentication)

#### Students
- `GET /students` - List students
- `POST /students` - Create student
- `GET /students/:id` - Get student
- `PUT /students/:id` - Update student
- `DELETE /students/:id` - Delete student

#### Teachers
- `GET /teachers` - List teachers
- `POST /teachers` - Create teacher
- `GET /teachers/:id` - Get teacher
- `PUT /teachers/:id` - Update teacher

#### Admin
- `GET /admin/dashboard` - Dashboard stats
- `GET /admin/departments` - List departments
- `POST /admin/departments` - Create department
- `GET /admin/classes` - List classes
- `POST /admin/classes` - Create class

#### Superuser (Superuser Only)
- `GET /superuser/overview` - Platform overview
- `GET /superuser/schools` - List all schools
- `POST /superuser/schools` - Create school

See [API_USAGE_DOCUMENTATION.md](../API_USAGE_DOCUMENTATION.md) for complete endpoint list.

## Rate Limiting

- **General API:** 100 requests/minute
- **Write Operations:** 50 requests/minute
- **Admin Actions:** 20 requests/minute
- **Auth Endpoints:** 5 requests/minute

## Multi-Tenant Architecture

The system uses schema-per-tenant isolation:

- Each school (tenant) has its own database schema
- All data is automatically scoped to the tenant
- Include `x-tenant-id` header in all protected requests
- Tenant ID is validated on every request

## Error Handling

All errors follow this format:

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "field": "fieldName"  // Optional
  }
}
```

Common status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

## Support

For API support:
- Email: support@example.com
- Documentation: See [API_USAGE_DOCUMENTATION.md](../API_USAGE_DOCUMENTATION.md)
- Issues: Report via GitHub issues

