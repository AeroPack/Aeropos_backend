# AeroPack Backend API Documentation

**Version:** 2.0.0  
**Base URL:** `http://localhost:5002`  
**Architecture:** Multi-Company REST API  
**Authentication:** JWT Bearer Token (Employee-based)

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Multi-Company Architecture](#multi-company-architecture)
4. [Common Patterns](#common-patterns)
5. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication-endpoints)
   - [Profile](#profile-endpoints)
   - [Employees](#employees-endpoints)
   - [Customers](#customers-endpoints)
   - [Suppliers](#suppliers-endpoints)
   - [Products](#products-endpoints)
   - [Categories](#categories-endpoints)
   - [Brands](#brands-endpoints)
   - [Units](#units-endpoints)
   - [Invoices](#invoices-endpoints)
   - [Sync](#sync-endpoint)
6. [Error Handling](#error-handling)
7. [Migration Guide](#migration-guide)

---

## Overview

The AeroPack Backend API is a multi-company REST API designed for inventory and invoice management. Each company has completely isolated data, and employees authenticate to access their company's information.

### Key Features

- **Multi-Company Architecture**: Complete data isolation per company
- **Employee Authentication**: Employees authenticate with email/password
- **Role-Based Access Control**: Admin and employee roles
- **JWT Authentication**: Secure token-based authentication
- **RESTful Design**: Standard HTTP methods and status codes
- **Automatic Company Filtering**: All queries automatically filter by authenticated employee's company
- **Soft Deletes**: Data is marked as deleted rather than permanently removed
- **UUID Support**: All entities have UUIDs for offline-first sync

---

## Authentication

### How Authentication Works

1. **Signup**: Creates a new company + owner employee account
2. **Login**: Employee authenticates with email/password
3. **Token Storage**: Store the JWT token securely in your app
4. **Token Usage**: Include token in `x-auth-token` header for all protected endpoints
5. **Token Validation**: Server validates token and extracts employee ID + company ID automatically

### Token Format

```
x-auth-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Expiration

Tokens currently do not expire. In production, implement token refresh logic.

---

## Multi-Company Architecture

### Data Model

```
┌─────────────┐
│  Companies  │ (Business Entities)
└──────┬──────┘
       │
       ├─── Employees (Authenticated Users)
       ├─── Customers
       ├─── Suppliers
       ├─── Products
       ├─── Categories
       ├─── Brands
       ├─── Units
       ├─── Invoices
       └─── Invoice Items
```

### Company Isolation

- Every business entity has a `companyId` field
- All queries automatically filter by the authenticated employee's company ID
- Cross-company access is impossible - returns 404 if attempting to access another company's data
- Creating entities automatically assigns the authenticated employee's company ID

### User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| **Owner** | Company owner (created during signup) | Full admin access + `isOwner: true` |
| **Admin** | Administrator employee | Can manage employees and company settings |
| **Employee** | Regular employee | Can access company data, limited management |
| **Customer** | People who buy from the company | Not authenticated (data only) |
| **Supplier** | Vendors who supply to the company | Not authenticated (data only) |

---

## Common Patterns

### Standard Request Headers

```http
Content-Type: application/json
x-auth-token: YOUR_JWT_TOKEN
```

### Standard Response Format

**Success Response:**
```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Example",
  "companyId": 1,
  "createdAt": "2026-01-29T10:00:00.000Z",
  "updatedAt": "2026-01-29T10:00:00.000Z"
}
```

**Error Response:**
```json
{
  "error": "Error message description"
}
```

### Pagination & Filtering

**Query Parameters:**
- `updatedSince` - ISO 8601 timestamp to get only updated records

Example:
```
GET /api/products?updatedSince=2026-01-29T10:00:00.000Z
```

### Soft Deletes

All entities support soft deletion:
- `isDeleted: false` - Active records (default)
- `isDeleted: true` - Deleted records (hidden from queries)

---

## API Endpoints

## Authentication Endpoints

### 1. Signup (Register New Company + Owner)

Create a new company and owner employee account.

**Endpoint:** `POST /api/auth/signup`  
**Authentication:** None required

**Request Body:**
```json
{
  "name": "John Doe",                    // Required - Owner name
  "email": "john@example.com",           // Required - Owner email (unique)
  "password": "password123",             // Required - Min 6 characters
  "phone": "1234567890",                 // Optional - Owner phone
  "businessName": "John's Store",        // Required - Company name
  "businessAddress": "123 Main St",      // Optional - Company address
  "taxId": "TAX123456",                  // Optional - Company tax ID
  "companyPhone": "555-0100",            // Optional - Company phone
  "companyEmail": "contact@store.com"    // Optional - Company email
}
```

**Success Response:** `201 Created`
```json
{
  "employee": {
    "id": 1,
    "uuid": "5b03edff-3516-42a7-a3a5-f9f1e6e8712e",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "role": "admin",
    "isOwner": true,
    "companyId": 1,
    "isDeleted": false,
    "createdAt": "2026-01-29T10:00:00.000Z",
    "updatedAt": "2026-01-29T10:00:00.000Z"
  },
  "company": {
    "id": 1,
    "uuid": "company-uuid",
    "businessName": "John's Store",
    "businessAddress": "123 Main St",
    "taxId": "TAX123456",
    "phone": "555-0100",
    "email": "contact@store.com",
    "logoUrl": null,
    "isDeleted": false,
    "createdAt": "2026-01-29T10:00:00.000Z",
    "updatedAt": "2026-01-29T10:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request` - Invalid email format, password too short, email already exists, or missing required fields
- `500 Internal Server Error` - Server error

**Validation Rules:**
- Email must be valid format and unique across all employees
- Password must be at least 6 characters
- Name and businessName are required

---

### 2. Login

Authenticate an existing employee.

**Endpoint:** `POST /api/auth/login`  
**Authentication:** None required

**Request Body:**
```json
{
  "email": "john@example.com",    // Required
  "password": "password123"       // Required
}
```

**Success Response:** `200 OK`
```json
{
  "employee": {
    "id": 1,
    "uuid": "5b03edff-3516-42a7-a3a5-f9f1e6e8712e",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "address": null,
    "position": null,
    "salary": null,
    "role": "admin",
    "isOwner": true,
    "companyId": 1,
    "isDeleted": false,
    "createdAt": "2026-01-29T10:00:00.000Z",
    "updatedAt": "2026-01-29T10:00:00.000Z"
  },
  "company": {
    "id": 1,
    "uuid": "company-uuid",
    "businessName": "John's Store",
    "businessAddress": "123 Main St",
    "taxId": "TAX123456",
    "phone": "555-0100",
    "email": "contact@store.com",
    "logoUrl": null,
    "isDeleted": false,
    "createdAt": "2026-01-29T10:00:00.000Z",
    "updatedAt": "2026-01-29T10:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request` - Missing email or password
- `401 Unauthorized` - Invalid credentials or account deleted
- `500 Internal Server Error` - Server error

---

### 3. Get Current User

Get the authenticated employee's information and company details.

**Endpoint:** `GET /api/auth/me`  
**Authentication:** Required

**Request Headers:**
```http
x-auth-token: YOUR_JWT_TOKEN
```

**Success Response:** `200 OK`
```json
{
  "employee": {
    "id": 1,
    "uuid": "5b03edff-3516-42a7-a3a5-f9f1e6e8712e",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "address": null,
    "position": "CEO",
    "salary": null,
    "role": "admin",
    "isOwner": true,
    "companyId": 1,
    "isDeleted": false,
    "createdAt": "2026-01-29T10:00:00.000Z",
    "updatedAt": "2026-01-29T10:00:00.000Z"
  },
  "company": {
    "id": 1,
    "uuid": "company-uuid",
    "businessName": "John's Store",
    "businessAddress": "123 Main St",
    "taxId": "TAX123456",
    "phone": "555-0100",
    "email": "contact@store.com",
    "logoUrl": "/uploads/profiles/logo.png",
    "isDeleted": false,
    "createdAt": "2026-01-29T10:00:00.000Z",
    "updatedAt": "2026-01-29T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - Employee or company not found
- `500 Internal Server Error` - Server error

---

## Profile Endpoints

### 1. Get Profile

Get current employee's profile and company information.

**Endpoint:** `GET /api/profile`  
**Authentication:** Required

**Success Response:** `200 OK`
```json
{
  "employee": { /* Employee object */ },
  "company": { /* Company object */ }
}
```

---

### 2. Update Employee Profile

Update the authenticated employee's personal information.

**Endpoint:** `PUT /api/profile`  
**Authentication:** Required

**Request Body:**
```json
{
  "name": "John Updated",           // Optional
  "email": "newemail@example.com",  // Optional (must be unique)
  "phone": "555-1234",              // Optional
  "address": "456 New St",          // Optional
  "position": "CEO",                // Optional
  "password": "newpassword123"      // Optional (min 6 characters)
}
```

**Success Response:** `200 OK`
```json
{
  "message": "Profile updated successfully",
  "employee": { /* Updated employee object without password */ }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid email format, email already in use, or password too short
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - Employee not found
- `500 Internal Server Error` - Server error

---

### 3. Update Company Information (Admin Only)

Update company information. Only admins and owners can perform this action.

**Endpoint:** `PUT /api/profile/company`  
**Authentication:** Required (Admin/Owner only)

**Request Body:**
```json
{
  "businessName": "New Business Name",  // Optional
  "businessAddress": "789 Business St", // Optional
  "taxId": "TAX-NEW-001",              // Optional
  "phone": "555-9999",                 // Optional
  "email": "info@newbusiness.com",     // Optional
  "logoUrl": "/uploads/new-logo.png"   // Optional
}
```

**Success Response:** `200 OK`
```json
{
  "message": "Company information updated successfully",
  "company": { /* Updated company object */ }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User is not an admin or owner
- `404 Not Found` - Company not found
- `500 Internal Server Error` - Server error

---

### 4. Upload Company Logo (Admin Only)

Upload a company logo image.

**Endpoint:** `POST /api/profile/upload-image`  
**Authentication:** Required (Admin/Owner only)  
**Content-Type:** `multipart/form-data`

**Request Body:**
- `image` - Image file (form-data)

**Success Response:** `200 OK`
```json
{
  "message": "Company logo uploaded successfully",
  "company": { /* Updated company object */ },
  "imageUrl": "/uploads/profiles/filename.png"
}
```

**Error Responses:**
- `400 Bad Request` - No file uploaded
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User is not an admin or owner
- `404 Not Found` - Company not found
- `500 Internal Server Error` - Server error

---

## Employees Endpoints

Manage company employees. Admin-only operations are marked.

### 1. List All Employees

**Endpoint:** `GET /api/employees`  
**Authentication:** Required

**Query Parameters:**
- `updatedSince` (optional) - ISO 8601 timestamp

**Success Response:** `200 OK`
```json
[
  {
    "id": 1,
    "uuid": "employee-uuid",
    "name": "Jane Smith",
    "email": "jane@company.com",
    "phone": "555-1234",
    "address": "123 Employee St",
    "position": "Sales Manager",
    "salary": 50000.00,
    "role": "employee",
    "isOwner": false,
    "companyId": 1,
    "isDeleted": false,
    "createdAt": "2026-01-29T10:00:00.000Z",
    "updatedAt": "2026-01-29T10:00:00.000Z"
  }
]
```

**Note:** Passwords are never included in responses.

---

### 2. Get Single Employee

**Endpoint:** `GET /api/employees/:uuid`  
**Authentication:** Required

**Success Response:** `200 OK`
```json
{
  "id": 1,
  "uuid": "employee-uuid",
  "name": "Jane Smith",
  "email": "jane@company.com",
  /* ... other employee fields without password ... */
}
```

**Error Responses:**
- `404 Not Found` - Employee not found or belongs to another company

---

### 3. Create Employee (Admin Only)

Create a new employee account. Only admins and owners can create employees.

**Endpoint:** `POST /api/employees`  
**Authentication:** Required (Admin/Owner only)

**Request Body:**
```json
{
  "name": "Jane Smith",              // Required
  "email": "jane@company.com",       // Required (unique)
  "password": "password123",         // Required (min 6 characters)
  "phone": "555-1234",               // Optional
  "address": "123 Employee St",      // Optional
  "position": "Sales Manager",       // Optional
  "salary": 50000.00,                // Optional
  "role": "employee"                 // Optional (default: "employee")
}
```

**Success Response:** `201 Created`
```json
{
  "id": 2,
  "uuid": "new-employee-uuid",
  "name": "Jane Smith",
  "email": "jane@company.com",
  "phone": "555-1234",
  "address": "123 Employee St",
  "position": "Sales Manager",
  "salary": 50000.00,
  "role": "employee",
  "isOwner": false,
  "companyId": 1,
  "isDeleted": false,
  "createdAt": "2026-01-29T10:00:00.000Z",
  "updatedAt": "2026-01-29T10:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields, invalid email, password too short, or email already exists
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User is not an admin or owner
- `500 Internal Server Error` - Server error

**Note:** `companyId` is automatically assigned from the authenticated employee's company.

---

### 4. Update Employee

**Endpoint:** `PUT /api/employees/:uuid`  
**Authentication:** Required

**Request Body:** Same as create, all fields optional

**Success Response:** `200 OK`

**Error Responses:**
- `404 Not Found` - Employee not found or belongs to another company

---

### 5. Delete Employee (Soft Delete)

**Endpoint:** `DELETE /api/employees/:uuid`  
**Authentication:** Required

**Success Response:** `200 OK`
```json
{
  "id": 2,
  "uuid": "employee-uuid",
  "name": "Jane Smith",
  "isDeleted": true,
  "updatedAt": "2026-01-29T12:00:00.000Z"
}
```

**Error Responses:**
- `404 Not Found` - Employee not found or belongs to another company

---

## Customers Endpoints

Manage the company's customers (people who buy from the business).

### 1. List All Customers

**Endpoint:** `GET /api/customers`  
**Authentication:** Required

**Query Parameters:**
- `updatedSince` (optional) - ISO 8601 timestamp

**Success Response:** `200 OK`
```json
[
  {
    "id": 1,
    "uuid": "136e1405-1f01-48aa-ac52-0ed1274bec72",
    "name": "Jane Customer",
    "email": "jane@customer.com",
    "phone": "9876543210",
    "address": "456 Oak Ave",
    "creditLimit": 5000.00,
    "currentBalance": 1200.50,
    "companyId": 1,
    "isDeleted": false,
    "createdAt": "2026-01-29T10:00:00.000Z",
    "updatedAt": "2026-01-29T10:00:00.000Z"
  }
]
```

---

### 2. Get Single Customer

**Endpoint:** `GET /api/customers/:uuid`  
**Authentication:** Required

**Success Response:** `200 OK`

**Error Responses:**
- `404 Not Found` - Customer not found or belongs to another company

---

### 3. Create Customer

**Endpoint:** `POST /api/customers`  
**Authentication:** Required

**Request Body:**
```json
{
  "name": "Jane Customer",           // Required
  "email": "jane@customer.com",      // Optional
  "phone": "9876543210",             // Optional
  "address": "456 Oak Ave",          // Optional
  "creditLimit": 5000.00,            // Optional, default: 0
  "currentBalance": 0.00             // Optional, default: 0
}
```

**Success Response:** `201 Created`

**Note:** `companyId` is automatically assigned from the authenticated employee's company.

---

### 4. Update Customer

**Endpoint:** `PUT /api/customers/:uuid`  
**Authentication:** Required

**Request Body:** Same as create, all fields optional

**Success Response:** `200 OK`

**Error Responses:**
- `404 Not Found` - Customer not found or belongs to another company

---

### 5. Delete Customer (Soft Delete)

**Endpoint:** `DELETE /api/customers/:uuid`  
**Authentication:** Required

**Success Response:** `200 OK`

**Error Responses:**
- `404 Not Found` - Customer not found or belongs to another company

---

## Suppliers Endpoints

Manage the company's suppliers. Same structure as Customers endpoints.

**Base Path:** `/api/suppliers`

**Endpoints:**
- `GET /api/suppliers` - List all suppliers
- `GET /api/suppliers/:uuid` - Get single supplier
- `POST /api/suppliers` - Create supplier
- `PUT /api/suppliers/:uuid` - Update supplier
- `DELETE /api/suppliers/:uuid` - Delete supplier

**Entity Structure:**
```json
{
  "id": 1,
  "uuid": "uuid-string",
  "name": "Supplier Name",
  "email": "supplier@example.com",
  "phone": "1234567890",
  "address": "Supplier Address",
  "companyId": 1,
  "isDeleted": false,
  "createdAt": "2026-01-29T10:00:00.000Z",
  "updatedAt": "2026-01-29T10:00:00.000Z"
}
```

---

## Products Endpoints

Manage the company's product catalog.

**Base Path:** `/api/products`

**Endpoints:**
- `GET /api/products` - List all products
- `GET /api/products/:uuid` - Get single product
- `POST /api/products` - Create product
- `PUT /api/products/:uuid` - Update product
- `DELETE /api/products/:uuid` - Delete product

**Entity Structure:**
```json
{
  "id": 1,
  "uuid": "product-uuid",
  "name": "Product Name",
  "sku": "SKU001",
  "description": "Product description",
  "price": 99.99,
  "cost": 50.00,
  "stockQuantity": 100,
  "categoryId": 1,
  "brandId": 1,
  "unitId": 1,
  "type": "retail",
  "packSize": "1kg",
  "isActive": true,
  "gstType": "inclusive",
  "gstRate": "18%",
  "imageUrl": "https://example.com/image.jpg",
  "discount": 10.00,
  "isPercentDiscount": false,
  "companyId": 1,
  "isDeleted": false,
  "createdAt": "2026-01-29T10:00:00.000Z",
  "updatedAt": "2026-01-29T10:00:00.000Z"
}
```

---

## Categories Endpoints

Manage product categories.

**Base Path:** `/api/categories`

**Endpoints:**
- `GET /api/categories` - List all
- `GET /api/categories/:uuid` - Get single
- `POST /api/categories` - Create
- `PUT /api/categories/:uuid` - Update
- `DELETE /api/categories/:uuid` - Delete

**Entity Structure:**
```json
{
  "id": 1,
  "uuid": "uuid-string",
  "name": "Electronics",
  "subcategory": "Mobile Phones",
  "isActive": true,
  "companyId": 1,
  "isDeleted": false,
  "createdAt": "2026-01-29T10:00:00.000Z",
  "updatedAt": "2026-01-29T10:00:00.000Z"
}
```

---

## Brands Endpoints

Manage product brands.

**Base Path:** `/api/brands`

**Endpoints:**
- `GET /api/brands` - List all
- `GET /api/brands/:uuid` - Get single
- `POST /api/brands` - Create
- `PUT /api/brands/:uuid` - Update
- `DELETE /api/brands/:uuid` - Delete

**Entity Structure:**
```json
{
  "id": 1,
  "uuid": "uuid-string",
  "name": "Samsung",
  "description": "Electronics manufacturer",
  "isActive": true,
  "companyId": 1,
  "isDeleted": false,
  "createdAt": "2026-01-29T10:00:00.000Z",
  "updatedAt": "2026-01-29T10:00:00.000Z"
}
```

---

## Units Endpoints

Manage units of measurement.

**Base Path:** `/api/units`

**Endpoints:**
- `GET /api/units` - List all
- `GET /api/units/:uuid` - Get single
- `POST /api/units` - Create
- `PUT /api/units/:uuid` - Update
- `DELETE /api/units/:uuid` - Delete

**Entity Structure:**
```json
{
  "id": 1,
  "uuid": "uuid-string",
  "name": "Piece",
  "symbol": "pcs",
  "isActive": true,
  "companyId": 1,
  "isDeleted": false,
  "createdAt": "2026-01-29T10:00:00.000Z",
  "updatedAt": "2026-01-29T10:00:00.000Z"
}
```

---

## Invoices Endpoints

Manage sales invoices.

**Base Path:** `/api/invoices`

### Entity Structure

**Invoice:**
```json
{
  "id": 1,
  "uuid": "invoice-uuid",
  "invoiceNumber": "INV-001",
  "customerId": 1,
  "date": "2026-01-29T10:00:00.000Z",
  "subtotal": 1000.00,
  "tax": 180.00,
  "discount": 50.00,
  "total": 1130.00,
  "signUrl": "https://signature-url.com",
  "companyId": 1,
  "createdAt": "2026-01-29T10:00:00.000Z",
  "updatedAt": "2026-01-29T10:00:00.000Z"
}
```

**Invoice Item:**
```json
{
  "id": 1,
  "uuid": "item-uuid",
  "invoiceId": 1,
  "productId": 5,
  "quantity": 10,
  "bonus": 2,
  "unitPrice": 100.00,
  "discount": 5.00,
  "totalPrice": 950.00,
  "companyId": 1,
  "createdAt": "2026-01-29T10:00:00.000Z"
}
```

**Endpoints:**
- `GET /api/invoices` - List all invoices
- `GET /api/invoices/:uuid` - Get single invoice with items
- `POST /api/invoices` - Create invoice with items
- `PUT /api/invoices/:uuid` - Update invoice
- `DELETE /api/invoices/:uuid` - Delete invoice

**Special Features:**
- **Walk-in Customer**: If `customerId` is null, automatically assigns to a "Walk-in Customer" for this company
- **Offline Sync**: If `uuid` is provided and already exists, updates the existing invoice
- **Product Validation**: Validates that all `productId` values exist before creating invoice

---

## Sync Endpoint

Bulk sync endpoint for offline-first applications.

**Endpoint:** `GET /api/sync`  
**Authentication:** Required

**Query Parameters:**
- `updatedSince` (optional) - ISO 8601 timestamp

**Success Response:** `200 OK`
```json
{
  "products": [ /* Array of products */ ],
  "categories": [ /* Array of categories */ ],
  "units": [ /* Array of units */ ],
  "brands": [ /* Array of brands */ ],
  "customers": [ /* Array of customers */ ],
  "invoices": [ /* Array of invoices */ ],
  "invoiceItems": [ /* Array of invoice items */ ]
}
```

**Note:** All data is automatically filtered by the authenticated employee's company.

---

## Error Handling

### Standard Error Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| `400` | Bad Request | Invalid input, validation errors |
| `401` | Unauthorized | Missing or invalid token, account deleted |
| `403` | Forbidden | Insufficient permissions (not admin/owner) |
| `404` | Not Found | Resource not found or belongs to another company |
| `500` | Internal Server Error | Server-side error |

### Error Response Format

```json
{
  "error": "Descriptive error message"
}
```

---

## Migration Guide

### Migrating from v1.0 (Tenant-based) to v2.0 (Company-based)

**Key Changes:**

1. **Authentication Response Structure**
   - **Old:** Returns `user` object with tenant data
   - **New:** Returns `employee` and `company` objects separately

2. **Field Naming**
   - `tenantId` → `companyId` (in all entities)
   - `profileImage` → `logoUrl` (in company)

3. **Employee Management**
   - Employees are now authenticated users (have email/password)
   - New fields: `role`, `isOwner`, `password`

4. **API Paths**
   - All endpoints now use `/api` prefix
   - Example: `/auth/signup` → `/api/auth/signup`

5. **Profile Management**
   - New endpoint: `PUT /api/profile/company` for company updates
   - Employee profile separate from company profile

**Migration Steps:**

1. Update your app to use new authentication response structure
2. Store both `employee` and `company` data from login/signup
3. Update all API calls to use `/api` prefix
4. Update references from `tenantId` to `companyId`
5. Implement employee management UI (for admins)
6. Update profile screens to separate employee and company info

---

**Last Updated:** 2026-01-29  
**API Version:** 2.0.0
