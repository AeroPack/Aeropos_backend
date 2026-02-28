# Profile API Integration Guide for Flutter

## Overview

The Profile API provides endpoints to retrieve and update user profile information. The API combines data from two database tables: `employees` (user personal info) and `companies` (business info).

---

## Authentication

All profile endpoints require authentication via JWT token in the request header:

```
x-auth-token: <JWT_TOKEN>
```

The token is obtained from the login endpoint (`POST /api/auth/login`) and contains the employee's UUID.

---

## GET /api/profile - Retrieve User Profile

### Request

**Method:** `GET`  
**Endpoint:** `http://localhost:5004/api/profile`  
**Headers:**
```
x-auth-token: <JWT_TOKEN>
```

**No request body required**

### How It Works (Backend Flow)

1. **Authentication Middleware** validates the JWT token and extracts `employeeId` and `companyId`
2. **Query Employee Data** from `employees` table using `employeeId`
3. **Query Company Data** from `companies` table using `companyId`
4. **Combine & Return** a flat JSON structure with both employee and company data

### Response Structure

**Success (200 OK):**
```json
{
  "name": "Test User",
  "email": "test@example.com",
  "phone": "1234567890",
  "address": "123 Main St",
  "position": "Manager",
  "userName": "test",
  "businessName": "Test Business",
  "companyName": "Test Business",
  "businessAddress": "123 Business Parkway",
  "taxId": "GSTIN12345",
  "companyPhone": "0987654321",
  "companyEmail": "business@test.com",
  "profileImage": "/uploads/profiles/logo.png",
  "imageUrl": "/uploads/profiles/logo.png"
}
```

**Field Mapping:**

| Response Field | Source | Description |
|---------------|--------|-------------|
| `name` | `employees.name` | Employee's full name |
| `email` | `employees.email` | Employee's email (login credential) |
| `phone` | `employees.phone` | Employee's phone number |
| `address` | `employees.address` | Employee's address |
| `position` | `employees.position` | Employee's job position/title |
| `userName` | Derived from email | Email prefix (before @) |
| `businessName` | `companies.businessName` | Company/business name |
| `companyName` | `companies.businessName` | Alias for businessName |
| `businessAddress`| `companies.businessAddress` | Company address |
| `taxId` | `companies.taxId` | Company Tax ID / GSTIN |
| `companyPhone` | `companies.phone` | Company phone number |
| `companyEmail` | `companies.email` | Company contact email |
| `profileImage` | `companies.logoUrl` | Company logo URL |
| `imageUrl` | `companies.logoUrl` | Alias for profileImage |

**Error Responses:**

```json
// 401 Unauthorized - Invalid or missing token
{
  "error": "Unauthorized"
}

// 404 Not Found - Employee or company not found
{
  "error": "Employee not found"
}

// 500 Internal Server Error
{
  "error": "Internal server error"
}
```

### Flutter Example (GET Profile)

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<Map<String, dynamic>> getProfile(String token) async {
  final response = await http.get(
    Uri.parse('http://localhost:5004/api/profile'),
    headers: {
      'x-auth-token': token,
    },
  );

  if (response.statusCode == 200) {
    return json.decode(response.body);
  } else {
    throw Exception('Failed to load profile: ${response.body}');
  }
}

// Usage:
void loadProfile() async {
  try {
    final profileData = await getProfile(yourAuthToken);
    print('Name: ${profileData['name']}');
    print('Email: ${profileData['email']}');
    print('Business: ${profileData['businessName']}');
    print('Logo: ${profileData['profileImage']}');
  } catch (e) {
    print('Error: $e');
  }
}
```

---

## PUT /api/profile - Update User Profile

### Request

**Method:** `PUT`  
**Endpoint:** `http://localhost:5004/api/profile`  
**Headers:**
```
Content-Type: application/json
x-auth-token: <JWT_TOKEN>
```

**Request Body (all fields optional):**
```json
{
  "name": "Updated Name",
  "email": "newemail@example.com",
  "phone": "9876543210",
  "address": "456 New Street",
  "position": "Senior Manager",
  "password": "newpassword123",
  "businessName": "Updated Business Name",
  "businessAddress": "New Address",
  "taxId": "NEWTAXID",
  "companyPhone": "1112223333"
}
```

### Updatable Fields

| Field | Table | Validation | Notes |
|-------|-------|------------|-------|
| `name` | `employees` | None | Employee's full name |
| `email` | `employees` | Valid email format, unique | Must be unique across all employees |
| `phone` | `employees` | None | Employee's phone number |
| `address` | `employees` | None | Employee's address |
| `position` | `employees` | None | Job title/position |
| `password` | `employees` | Min 6 characters | Hashed with bcrypt before storing |
| `businessName` | `companies` | None | Updates company name |
| `businessAddress` | `companies` | None | Updates company address |
| `taxId` | `companies` | None | Updates company Tax ID |
| `companyPhone` | `companies` | None | Updates company phone (use 'phone' for employee) |
| `companyEmail` | `companies` | None | Updates company email (use 'email' for employee) |

**Important Notes:**
- You can send **any combination** of fields - only provided fields will be updated
- `userName` is **not updatable** - it's derived from email
- `profileImage`/`imageUrl` are **not updated** via this endpoint (use image upload endpoint)

### How It Works (Backend Flow)

1. **Authentication** validates JWT token
2. **Fetch Current Employee** to check existing data
3. **Validate Email** (if provided):
   - Check valid email format
   - Ensure email is not already used by another employee
4. **Validate Password** (if provided):
   - Ensure minimum 6 characters
   - Hash password with bcrypt
5. **Update Employee Data** in `employees` table
6. **Update Company Data** (if `businessName` provided) in `companies` table
7. **Return Updated Profile** in same format as GET endpoint

### Response Structure

**Success (200 OK):**
```json
{
  "message": "Profile updated successfully",
  "name": "Updated Name",
  "email": "newemail@example.com",
  "phone": "9876543210",
  "address": "456 New Street",
  "position": "Senior Manager",
  "userName": "newemail",
  "businessName": "Updated Business Name",
  "companyName": "Updated Business Name",
  "profileImage": "/uploads/profiles/logo.png",
  "imageUrl": "/uploads/profiles/logo.png"
}
```

**Error Responses:**

```json
// 400 Bad Request - Invalid email format
{
  "error": "Invalid email format"
}

// 400 Bad Request - Email already in use
{
  "error": "Email already in use"
}

// 400 Bad Request - Password too short
{
  "error": "Password must be at least 6 characters long"
}

// 401 Unauthorized
{
  "error": "Unauthorized"
}

// 404 Not Found
{
  "error": "Employee not found"
}

// 500 Internal Server Error
{
  "error": "Internal server error"
}
```

### Flutter Example (PUT Profile)

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<Map<String, dynamic>> updateProfile({
  required String token,
  String? name,
  String? email,
  String? phone,
  String? address,
  String? position,
  String? password,
  String? businessName,
}) async {
  // Build request body with only provided fields
  final Map<String, dynamic> body = {};
  if (name != null) body['name'] = name;
  if (email != null) body['email'] = email;
  if (phone != null) body['phone'] = phone;
  if (address != null) body['address'] = address;
  if (position != null) body['position'] = position;
  if (password != null) body['password'] = password;
  if (businessName != null) body['businessName'] = businessName;

  final response = await http.put(
    Uri.parse('http://localhost:5004/api/profile'),
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': token,
    },
    body: json.encode(body),
  );

  if (response.statusCode == 200) {
    return json.decode(response.body);
  } else {
    final error = json.decode(response.body);
    throw Exception('Failed to update profile: ${error['error']}');
  }
}

// Usage Example 1: Update only name and phone
void updateNameAndPhone() async {
  try {
    final result = await updateProfile(
      token: yourAuthToken,
      name: 'John Doe',
      phone: '1234567890',
    );
    print('Success: ${result['message']}');
    print('Updated name: ${result['name']}');
  } catch (e) {
    print('Error: $e');
  }
}

// Usage Example 2: Update email and password
void updateCredentials() async {
  try {
    final result = await updateProfile(
      token: yourAuthToken,
      email: 'newemail@example.com',
      password: 'newpassword123',
    );
    print('Success: ${result['message']}');
    print('New email: ${result['email']}');
  } catch (e) {
    print('Error: $e');
  }
}

// Usage Example 3: Update business name
void updateBusinessName() async {
  try {
    final result = await updateProfile(
      token: yourAuthToken,
      businessName: 'My New Company Name',
    );
    print('Success: ${result['message']}');
    print('New business name: ${result['businessName']}');
  } catch (e) {
    print('Error: $e');
  }
}
```

---

## Complete Flutter Profile Screen Example

```dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class ProfileScreen extends StatefulWidget {
  final String authToken;

  const ProfileScreen({required this.authToken});

  @override
  _ProfileScreenState createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  
  // Form controllers
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _positionController = TextEditingController();
  final _businessNameController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() => _isLoading = true);
    
    try {
      final response = await http.get(
        Uri.parse('http://localhost:5004/api/profile'),
        headers: {'x-auth-token': widget.authToken},
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        
        // Populate form fields
        _nameController.text = data['name'] ?? '';
        _emailController.text = data['email'] ?? '';
        _phoneController.text = data['phone'] ?? '';
        _addressController.text = data['address'] ?? '';
        _positionController.text = data['position'] ?? '';
        _businessNameController.text = data['businessName'] ?? '';
      } else {
        _showError('Failed to load profile');
      }
    } catch (e) {
      _showError('Error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final response = await http.put(
        Uri.parse('http://localhost:5004/api/profile'),
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': widget.authToken,
        },
        body: json.encode({
          'name': _nameController.text,
          'email': _emailController.text,
          'phone': _phoneController.text,
          'address': _addressController.text,
          'position': _positionController.text,
          'businessName': _businessNameController.text,
        }),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _showSuccess(data['message']);
      } else {
        final error = json.decode(response.body);
        _showError(error['error']);
      }
    } catch (e) {
      _showError('Error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.green),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Profile')),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: EdgeInsets.all(16),
                children: [
                  TextFormField(
                    controller: _nameController,
                    decoration: InputDecoration(labelText: 'Name'),
                    validator: (v) => v!.isEmpty ? 'Required' : null,
                  ),
                  TextFormField(
                    controller: _emailController,
                    decoration: InputDecoration(labelText: 'Email'),
                    validator: (v) => v!.isEmpty ? 'Required' : null,
                  ),
                  TextFormField(
                    controller: _phoneController,
                    decoration: InputDecoration(labelText: 'Phone'),
                  ),
                  TextFormField(
                    controller: _addressController,
                    decoration: InputDecoration(labelText: 'Address'),
                  ),
                  TextFormField(
                    controller: _positionController,
                    decoration: InputDecoration(labelText: 'Position'),
                  ),
                  TextFormField(
                    controller: _businessNameController,
                    decoration: InputDecoration(labelText: 'Business Name'),
                  ),
                  SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _saveProfile,
                    child: Text('Save Profile'),
                  ),
                ],
              ),
            ),
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _positionController.dispose();
    _businessNameController.dispose();
    super.dispose();
  }
}
```

---

## Key Points for Flutter Integration

1. **Always include the auth token** in the `x-auth-token` header
2. **GET returns all fields** - use this to pre-populate your form
3. **PUT accepts partial updates** - only send fields you want to change
4. **userName is read-only** - it's automatically derived from email
5. **Profile image** is updated via separate endpoint (`POST /api/profile/upload-image`)
6. **Email must be unique** - validate before sending
7. **Password is optional** - only send if user wants to change it
8. **Response format is consistent** - both GET and PUT return the same structure

---

## Testing with cURL

```bash
# Get profile
curl -X GET http://localhost:5004/api/profile \
  -H "x-auth-token: YOUR_TOKEN_HERE"

# Update profile
curl -X PUT http://localhost:5004/api/profile \
  -H "Content-Type: application/json" \
  -H "x-auth-token: YOUR_TOKEN_HERE" \
  -d '{
    "name": "John Doe",
    "phone": "1234567890",
    "businessName": "My Company"
  }'
```
