# ERD — Sơ đồ quan hệ Database (C2-App-142)

_Sinh tự động từ DB PostgreSQL thực tế bằng `scripts/generate_erd.py` — 14 bảng, 18 khóa ngoại._

> Xem trực quan: mở file này trong VS Code (extension *Markdown Preview Mermaid*) hoặc dán khối mermaid vào https://mermaid.live . Trên PostgreSQL: pgAdmin → chuột phải database → **ERD For Database**.

```mermaid
erDiagram
  conversations ||--o{ agent_runs : "conversation_id · SET NULL"
  document_chunks ||--o{ citations : "chunk_id · CASCADE"
  documents ||--o{ citations : "document_id · CASCADE"
  messages ||--o{ citations : "message_id · CASCADE"
  users ||--o{ conversations : "user_id · SET NULL"
  documents ||--o{ document_chunks : "document_id · CASCADE"
  documents ||--o{ document_views : "document_id · CASCADE"
  users ||--o{ document_views : "user_id · CASCADE"
  users ||--o{ documents : "uploaded_by · SET NULL"
  users ||--o{ exams : "created_by · SET NULL"
  messages ||--o{ message_feedback : "message_id · CASCADE"
  users ||--o{ message_feedback : "user_id · SET NULL"
  messages ||--o{ message_signals : "message_id · CASCADE"
  users ||--o{ message_signals : "user_id · SET NULL"
  conversations ||--o{ messages : "conversation_id · CASCADE"
  users ||--o{ password_reset_otps : "user_id · CASCADE"
  users ||--o{ students : "created_by · SET NULL"
  roles ||--o{ users : "role_id · SET NULL"

  agent_runs {
    string id PK
    string conversation_id FK
    string user_message_id
    string assistant_message_id
    string status
    string model_name
    string embedding_model
    int latency_ms
    text error
    json metadata
    datetime created_at
    datetime updated_at
  }
  citations {
    string id PK
    string message_id FK
    string document_id FK
    string chunk_id FK
    int page_number
    text quote
    float score
    datetime created_at
  }
  conversations {
    string id PK
    string user_id FK
    string title
    datetime created_at
    datetime updated_at
  }
  document_chunks {
    string id PK
    string document_id FK
    int chunk_index
    text content
    int page_number
    int token_count
    string qdrant_point_id
    json metadata
    datetime created_at
  }
  document_views {
    string id PK
    string document_id FK
    string user_id FK
    datetime viewed_at
  }
  documents {
    string id PK
    string uploaded_by FK
    string title
    string file_name
    string file_type
    string storage_path
    string status
    int total_pages
    int total_chunks
    json metadata
    datetime created_at
    datetime updated_at
  }
  exams {
    string id PK
    string subject
    string title
    datetime exam_date
    string room
    int duration_minutes
    string note
    string created_by FK
    datetime created_at
    datetime updated_at
  }
  message_feedback {
    string id PK
    string message_id FK
    string user_id FK
    string rating
    text reason
    datetime created_at
    datetime updated_at
  }
  message_signals {
    string id PK
    string message_id FK
    string user_id FK
    string kind
    string name
    float value
    datetime created_at
  }
  messages {
    string id PK
    string conversation_id FK
    string role
    text content
    json metadata
    datetime created_at
  }
  password_reset_otps {
    string id PK
    string user_id FK
    string email
    string otp_code
    datetime expired_at
    int attempts
    bool is_used
    datetime created_at
  }
  roles {
    string id PK
    string name
    datetime created_at
  }
  students {
    string id PK
    string student_code
    string full_name
    string email
    string subject
    string note
    string created_by FK
    datetime created_at
    datetime updated_at
  }
  users {
    string id PK
    string email
    string phone_number
    string password
    string full_name
    string role_id FK
    string status
    datetime created_at
    string username
  }
```

## Danh sách khóa ngoại

| Bảng nguồn | Cột | → Bảng đích | ON DELETE |
|---|---|---|---|
| agent_runs | conversation_id | conversations | SET NULL |
| citations | chunk_id | document_chunks | CASCADE |
| citations | document_id | documents | CASCADE |
| citations | message_id | messages | CASCADE |
| conversations | user_id | users | SET NULL |
| document_chunks | document_id | documents | CASCADE |
| document_views | document_id | documents | CASCADE |
| document_views | user_id | users | CASCADE |
| documents | uploaded_by | users | SET NULL |
| exams | created_by | users | SET NULL |
| message_feedback | message_id | messages | CASCADE |
| message_feedback | user_id | users | SET NULL |
| message_signals | message_id | messages | CASCADE |
| message_signals | user_id | users | SET NULL |
| messages | conversation_id | conversations | CASCADE |
| password_reset_otps | user_id | users | CASCADE |
| students | created_by | users | SET NULL |
| users | role_id | roles | SET NULL |
