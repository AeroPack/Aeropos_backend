# Flutter Frontend Sync API Documentation

This document provides step-by-step instructions for Flutter developers to sync data with the backend using the unified `/api/sync` endpoint.

---

## 📋 Overview

| Aspect | Details |
|--------|---------|
| Endpoint | `POST http://<server>:5004/api/sync` |
| Protocol | HTTP REST |
| Authentication | Bearer JWT Token |
| Content-Type | `application/json` |

---

## 🔐 Phase 1: Authentication (Login)

Before syncing, the Flutter app must authenticate to get a JWT token.

### Request
```bash
curl -X POST http://localhost:5004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

### Response
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "employee": {
    "id": 1,
    "uuid": "435b861c-e167-4d91-bb4f-a11353e13865",
    "name": "John Doe",
    "companyId": 7
  }
}
```

### Flutter Implementation
```dart
Future<LoginResponse> login(String email, String password) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/auth/login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'email': email, 'password': password}),
  );

  if (response.statusCode == 200) {
    return LoginResponse.fromJson(jsonDecode(response.body));
  } else {
    throw Exception('Login failed: ${response.body}');
  }
}
```

---

## 📥 Phase 2: Pull Sync (Get Data from Backend)

Pull sync fetches all changes from the backend since the last sync timestamp.

### Request Structure
```json
{
  "deviceId": "unique-device-id",
  "lastPulledAt": "2026-01-01T00:00:00.000Z",
  "operations": []
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deviceId` | String | Yes | Unique identifier for this device |
| `lastPulledAt` | ISO 8601 DateTime | Yes | Timestamp of last successful pull |
| `operations` | Array | Yes | Empty array for pull-only |

### Curl Example
```bash
curl -X POST http://localhost:5004/api/sync \
  -H "Authorization: Bearer <token>" \
  -H "X-Company-Id: 7" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "device-123",
    "lastPulledAt": "2026-01-01T00:00:00.000Z",
    "operations": []
  }'
```

### Response Structure
```json
{
  "serverTime": "2026-04-20T10:00:00.000Z",
  "acknowledged": [],
  "operations": [
    {
      "opId": "550e8400-e29b-41d4-a716-446655440000",
      "type": "INSERT",
      "table": "units",
      "recordId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "data": {
        "id": 1,
        "uuid": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "name": "Kilogram",
        "symbol": "kg",
        "companyId": 7
      },
      "timestamp": "2026-04-20T09:00:00.000Z"
    }
  ],
  "nextCursor": "2026-04-20T10:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `serverTime` | String | Server timestamp when response was generated |
| `acknowledged` | Array | Operations that were successfully processed |
| `operations` | Array | New/updated operations to apply locally |
| `nextCursor` | String | Use as `lastPulledAt` for next pull |

### Flutter Implementation
```dart
Future<PullResponse> pullSync({
  required String token,
  required int companyId,
  required String deviceId,
  required DateTime lastPulledAt,
}) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/sync'),
    headers: {
      'Authorization': 'Bearer $token',
      'X-Company-Id': companyId.toString(),
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'deviceId': deviceId,
      'lastPulledAt': lastPulledAt.toIso8601String(),
      'operations': [],
    }),
  );

  if (response.statusCode == 200) {
    return PullResponse.fromJson(jsonDecode(response.body));
  } else {
    throw Exception('Pull failed: ${response.body}');
  }
}
```

---

## 📤 Phase 3: Push Sync (Send Data to Backend)

Push sync sends local changes (INSERT, UPDATE, DELETE) to the backend.

### Request Structure
```json
{
  "deviceId": "unique-device-id",
  "lastPulledAt": "2026-01-01T00:00:00.000Z",
  "operations": [
    {
      "opId": "550e8400-e29b-41d4-a716-446655440000",
      "type": "INSERT",
      "table": "units",
      "recordId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "data": {
        "name": "Kilogram",
        "symbol": "kg"
      },
      "timestamp": "2026-04-20T10:00:00.000Z"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `opId` | UUID | Yes | Unique operation ID (use UUID v4) |
| `type` | String | Yes | `INSERT`, `UPDATE`, or `DELETE` |
| `table` | String | Yes | Target table name |
| `recordId` | UUID | Yes | UUID of the record |
| `data` | Object | For INSERT/UPDATE | Data to save |
| `timestamp` | ISO 8601 | Yes | Client timestamp |

### Valid Tables
- `products`
- `categories`
- `units`
- `brands`
- `customers`
- `suppliers`
- `invoices`
- `invoice_items`
- `employees`

### Curl Example
```bash
curl -X POST http://localhost:5004/api/sync \
  -H "Authorization: Bearer <token>" \
  -H "X-Company-Id: 7" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "device-123",
    "lastPulledAt": "2026-01-01T00:00:00.000Z",
    "operations": [
      {
        "opId": "550e8400-e29b-41d4-a716-446655440000",
        "type": "INSERT",
        "table": "units",
        "recordId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "data": {
          "name": "Kilogram",
          "symbol": "kg"
        },
        "timestamp": "2026-04-20T10:00:00.000Z"
      }
    ]
  }'
```

### Response Structure
```json
{
  "serverTime": "2026-04-20T10:00:00.000Z",
  "acknowledged": [
    {
      "opId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "SUCCESS"
    }
  ],
  "operations": [],
  "nextCursor": "2026-04-20T10:00:00.000Z"
}
```

| `acknowledged[].status` | Meaning |
|---------------------|--------|
| `SUCCESS` | Operation was processed successfully |
| `FAILED` | Operation failed - check `error` field |

### Error Response (Failed Operation)
```json
{
  "acknowledged": [
    {
      "opId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "FAILED",
      "error": {
        "code": "FOREIGN_KEY_NOT_FOUND",
        "message": "Cannot resolve unit_uuid in units"
      }
    }
  ]
}
```

### Error Codes
| Code | Meaning | Action |
|------|---------|--------|
| `VALIDATION_ERROR` | Invalid data | Check data format |
| `NOT_FOUND` | Record not found | Fetch latest data |
| `FOREIGN_KEY_NOT_FOUND` | Reference invalid | Verify references |
| `TIMESTAMP_CONFLICT` | Older version on server | Pull and retry |
| `DUPLICATE` | Already exists | Ignore (idempotent) |

### Flutter Implementation
```dart
Future<PushResponse> pushSync({
  required String token,
  required int companyId,
  required String deviceId,
  required DateTime lastPulledAt,
  required List<SyncOperation> operations,
}) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/sync'),
    headers: {
      'Authorization': 'Bearer $token',
      'X-Company-Id': companyId.toString(),
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'deviceId': deviceId,
      'lastPulledAt': lastPulledAt.toIso8601String(),
      'operations': operations.map((op) => op.toJson()).toList(),
    }),
  );

  if (response.statusCode == 200) {
    return PushResponse.fromJson(jsonDecode(response.body));
  } else {
    throw Exception('Push failed: ${response.body}');
  }
}
```

---

## 🔄 Phase 4: Complete Sync Flow (Push + Pull)

A typical sync cycle performs both push and pull in a single request.

### Combined Request
```json
{
  "deviceId": "device-123",
  "lastPulledAt": "2026-01-01T00:00:00.000Z",
  "operations": [
    {
      "opId": "550e8400-e29b-41d4-a716-446655440000",
      "type": "INSERT",
      "table": "units",
      "recordId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "data": {"name": "Kilogram", "symbol": "kg"},
      "timestamp": "2026-04-20T10:00:00.000Z"
    }
  ]
}
```

### Combined Response
```json
{
  "serverTime": "2026-04-20T10:00:00.000Z",
  "acknowledged": [
    {"opId": "550e8400-e29b-41d4-a716-446655440000", "status": "SUCCESS"}
  ],
  "operations": [
    {
      "opId": "660e8400-e29b-41d4-a716-446655440001",
      "type": "UPDATE",
      "table": "products",
      "recordId": "7bb7b810-9dad-11d1-80b4-00c04fd430c9",
      "data": {"name": "Updated Product"},
      "timestamp": "2026-04-20T09:30:00.000Z"
    }
  ],
  "nextCursor": "2026-04-20T10:00:00.000Z"
}
```

---

## 🔌 Phase 5: Flutter SyncService Implementation

Here's a complete example of how to implement sync_service.dart:

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class SyncService {
  static const String _baseUrl = 'http://10.0.2.2:5004'; // Use 10.0.2.2 for Android Emulator
  // Use localhost:5004 for iOS Simulator
  // Use your server IP for real device

  late Database _db;
  String? _token;
  int? _companyId;
  String? _deviceId;

  // Initialize database
  Future<void> init() async {
    _db = await openDatabase(
      join(await getDatabasesPath(), 'app.db'),
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE sync_metadata (
            key TEXT PRIMARY KEY,
            value TEXT
          )
        ''');
      },
    );
  }

  // Save token and company info
  Future<void> setAuth({
    required String token,
    required int companyId,
    required String deviceId,
  }) async {
    _token = token;
    _companyId = companyId;
    _deviceId = deviceId;
  }

  // Get last sync timestamp
  Future<DateTime> getLastSyncTime() async {
    final result = await _db.query(
      'sync_metadata',
      where: 'key = ?',
      whereArgs: ['lastSyncTime'],
    );
    if (result.isEmpty) {
      return DateTime.utc(2026, 1, 1); // Default to epoch
    }
    return DateTime.parse(result.first['value'] as String);
  }

  // Save last sync timestamp
  Future<void> _saveLastSyncTime(DateTime time) async {
    await _db.insert(
      'sync_metadata',
      {'key': 'lastSyncTime', 'value': time.toIso8601String()},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // Login
  Future<void> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );

    if (response.statusCode != 200) {
      throw Exception('Login failed');
    }

    final data = jsonDecode(response.body);
    _token = data['token'];
    _companyId = data['employee']['companyId'];
    _deviceId = DateTime.now().millisecondsSinceEpoch.toString();
  }

  // Sync (push + pull)
  Future<void> sync() async {
    if (_token == null || _companyId == null || _deviceId == null) {
      throw Exception('Not authenticated. Call login() first.');
    }

    final lastSyncTime = await getLastSyncTime();

    // Get pending local operations
    final pendingOps = await _getPendingOperations();

    final response = await http.post(
      Uri.parse('$_baseUrl/api/sync'),
      headers: {
        'Authorization': 'Bearer $_token',
        'X-Company-Id': _companyId.toString(),
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'deviceId': _deviceId,
        'lastPulledAt': lastSyncTime.toIso8601String(),
        'operations': pendingOps,
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Sync failed: ${response.body}');
    }

    final data = jsonDecode(response.body);

    // Apply acknowledged operations (mark as synced)
    for (final ack in data['acknowledged']) {
      if (ack['status'] == 'SUCCESS') {
        await _markOperationSynced(ack['opId']);
      }
    }

    // Apply pulled operations to local DB
    for (final op in data['operations']) {
      await _applyOperation(op);
    }

    // Save new sync timestamp
    if (data['nextCursor'] != null) {
      await _saveLastSyncTime(DateTime.parse(data['nextCursor']));
    }
  }

  // Get pending operations from local DB
  Future<List<Map<String, dynamic>>> _getPendingOperations() async {
    return await _db.query(
      'sync_queue',
      where: 'synced = ?',
      whereArgs: [0],
    );
  }

  // Mark operation as synced
  Future<void> _markOperationSynced(String opId) async {
    await _db.update(
      'sync_queue',
      {'synced': 1},
      where: 'opId = ?',
      whereArgs: [opId],
    );
  }

  // Apply pulled operation to local DB
  Future<void> _applyOperation(Map<String, dynamic> op) async {
    final table = op['table'];
    final recordId = op['recordId'];
    final data = op['data'] as Map<String, dynamic>?;

    switch (op['type']) {
      case 'INSERT':
        await _db.insert(table, {...data, 'uuid': recordId, 'synced': 1});
        break;
      case 'UPDATE':
        await _db.update(
          table,
          data,
          where: 'uuid = ?',
          whereArgs: [recordId],
        );
        break;
      case 'DELETE':
        await _db.delete(
          table,
          where: 'uuid = ?',
          whereArgs: [recordId],
        );
        break;
    }
  }
}
```

---

## 🔧 Phase 6: Offline-First Strategy

### Sync Queue Table (SQLite)
```sql
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opId TEXT UNIQUE,
  table_name TEXT,
  record_uuid TEXT,
  operation TEXT,
  data TEXT,
  timestamp TEXT,
  synced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Adding to Queue
```dart
Future<void> queueOperation({
  required String operation,
  required String table,
  required String recordUuid,
  required Map<String, dynamic> data,
}) async {
  await _db.insert('sync_queue', {
    'opId': Uuid.v4().toString(),
    'table_name': table,
    'record_uuid': recordUuid,
    'operation': operation,
    'data': jsonEncode(data),
    'timestamp': DateTime.now().toIso8601String(),
    'synced': 0,
  });
}
```

### Pulling Changes to Local DB
```dart
// After getting operations from server
for (final op in serverOperations) {
  final data = op['data'];
  
  switch (op['type']) {
    case 'INSERT':
      await db.insert(table, data);
      break;
    case 'UPDATE':
      await db.update(
        table,
        data,
        where: 'uuid = ?',
        whereArgs: [op['recordId']],
      );
      break;
    case 'DELETE':
      await db.delete(
        table,
        where: 'uuid = ?',
        whereArgs: [op['recordId']],
      );
      break;
  }
}
```

---

## ⚠️ Important Notes

1. **UUID Format**: Always use UUID v4 for `opId` and `recordId`
2. **Timestamps**: Use ISO 8601 format (e.g., `2026-04-20T10:00:00.000Z`)
3. **Idempotency**: Same `opId` will return SUCCESS on retry
4. **Conflict Handling**: If `TIMESTAMP_CONFLICT`, pull latest and retry
5. **Batch Limit**: Maximum 1000 operations per request

---

## 🧪 Testing

### Test Login
```bash
curl -X POST http://localhost:5004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email", "password": "your-password"}'
```

### Test Pull
```bash
curl -X POST http://localhost:5004/api/sync \
  -H "Authorization: Bearer <token>" \
  -H "X-Company-Id: 7" \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "test", "lastPulledAt": "2026-01-01T00:00:00.000Z", "operations": []}'
```

### Test Push
```bash
curl -X POST http://localhost:5004/api/sync \
  -H "Authorization: Bearer <token>" \
  -H "X-Company-Id: 7" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "test",
    "lastPulledAt": "2026-01-01T00:00:00.000Z",
    "operations": [
      {
        "opId": "550e8400-e29b-41d4-a716-446655440000",
        "type": "INSERT",
        "table": "units",
        "recordId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "data": {"name": "Test Unit"},
        "timestamp": "2026-04-20T10:00:00.000Z"
      }
    ]
  }'
```