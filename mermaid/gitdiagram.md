Base diagram code from here: https://gitdiagram.com/Shounak-Ghosh/mobile-food-drive
```mermaid
flowchart TD
    %% Frontend Layer
    subgraph "Frontend (React/Vite/Tailwind)" 
        direction TB
        FE_MAIN["main.jsx"]:::frontend
        FE_APP["App.jsx"]:::frontend
        subgraph "Pages" 
            direction TB
            FE_LP["LandingPage.jsx"]:::frontend
            FE_LOGIN["Login.jsx"]:::frontend
            FE_REGISTER["Register.jsx"]:::frontend
            FE_ACCOUNT["AccountDetails.jsx"]:::frontend
        end
        subgraph "Components"
            direction TB
            FE_HEADER["Header.jsx"]:::frontend
            FE_MAP["Map.jsx"]:::frontend
            FE_MARKER_DETAIL["MarkerDetail.jsx"]:::frontend
            FE_MARKER_FORM["MarkerForm.jsx"]:::frontend
            FE_NOTIFICATION["Notification.jsx"]:::frontend
            FE_NOTIF_HISTORY["NotificationsHistory.jsx"]:::frontend
            FE_PROTECTED["ProtectedRoute.jsx"]:::frontend
            FE_SEARCH["SearchBox.jsx"]:::frontend
        end
        subgraph "API & Context"
            direction TB
            FE_AXIOS["axios.js"]:::frontend
            FE_CONTEXT["NotificationsContext.jsx"]:::frontend
        end
    end

    %% Backend Layer
    subgraph "Backend (FastAPI)" 
        direction TB
        subgraph "HTTP Interface"
            direction TB
            BE_MAIN["main.py"]:::backend
            BE_APP_MAIN["/app/main.py"]:::backend
        end
        subgraph "Core Config & Security"
            direction TB
            BE_CONFIG["config.py"]:::backend
            BE_SECURITY["security.py"]:::backend
        end
        subgraph "Routers (API Layer)"
            direction TB
            BE_AUTH["auth.py"]:::backend
            BE_USERS["users.py"]:::backend
            BE_TRANSACTION["transaction.py"]:::backend
            BE_MARKER["marker.py"]:::backend
            BE_NOTIFICATION_ROUTE["notification.py"]:::backend
        end
        subgraph "Business Logic / CRUD"
            direction TB
            BE_CRUD_NOTIF["notification.py"]:::backend
        end
        subgraph "Data-Access Layer"
            direction TB
            BE_DB_SESSION["session.py"]:::backend
            BE_DB_BASE["base_class.py"]:::backend
        end
        subgraph "Models"
            direction TB
            BE_MODEL_USER["user.py"]:::backend
            BE_MODEL_TRANS["transaction.py"]:::backend
            BE_MODEL_MARKER["marker.py"]:::backend
            BE_MODEL_NOTIF["notification.py"]:::backend
        end
        subgraph "Schemas"
            direction TB
            BE_SCHEMA_USER["user.py"]:::backend
            BE_SCHEMA_TRANS["transaction.py"]:::backend
            BE_SCHEMA_MARKER["marker.py"]:::backend
            BE_SCHEMA_NOTIF["notification.py"]:::backend
        end
        BE_TASKS["tasks.py"]:::tasks
    end

    %% Database and External Services
    DB[(Relational DB)]:::db
    EXT["Email/SMS Gateway"]:::external

    %% Connections: Frontend to Backend
    FE_APP -->|"uses Router"| FE_AXIOS
    FE_LP --> FE_APP
    FE_LOGIN --> FE_APP
    FE_REGISTER --> FE_APP
    FE_ACCOUNT --> FE_APP
    FE_HEADER --> FE_APP
    FE_MAP --> FE_APP
    FE_MARKER_DETAIL --> FE_APP
    FE_MARKER_FORM --> FE_APP
    FE_NOTIFICATION --> FE_APP
    FE_NOTIF_HISTORY --> FE_APP
    FE_PROTECTED --> FE_APP
    FE_SEARCH --> FE_APP
    FE_AXIOS -->|"HTTP requests"| BE_MAIN

    %% Backend flow
    BE_MAIN --> BE_APP_MAIN
    BE_APP_MAIN -->|"includes"| BE_CONFIG
    BE_APP_MAIN --> BE_SECURITY
    BE_APP_MAIN --> BE_AUTH
    BE_APP_MAIN --> BE_USERS
    BE_APP_MAIN --> BE_TRANSACTION
    BE_APP_MAIN --> BE_MARKER
    BE_APP_MAIN --> BE_NOTIFICATION_ROUTE

    %% Routers to Logic
    BE_AUTH -->|"calls"| BE_CRUD_NOTIF
    BE_USERS --> BE_DB_SESSION
    BE_TRANSACTION --> BE_DB_SESSION
    BE_MARKER --> BE_DB_SESSION
    BE_NOTIFICATION_ROUTE --> BE_CRUD_NOTIF

    %% CRUD to DB
    BE_CRUD_NOTIF --> BE_DB_SESSION
    BE_DB_SESSION --> DB
    BE_DB_BASE --> DB
    BE_MODEL_USER --> BE_DB_BASE
    BE_MODEL_TRANS --> BE_DB_BASE
    BE_MODEL_MARKER --> BE_DB_BASE
    BE_MODEL_NOTIF --> BE_DB_BASE

    %% Schemas to Routers
    BE_AUTH --> BE_SCHEMA_USER
    BE_USERS --> BE_SCHEMA_USER
    BE_TRANSACTION --> BE_SCHEMA_TRANS
    BE_MARKER --> BE_SCHEMA_MARKER
    BE_NOTIFICATION_ROUTE --> BE_SCHEMA_NOTIF

    %% Background tasks
    BE_TASKS -->|"schedules"| BE_CRUD_NOTIF
    BE_TASKS -->| sends | EXT
    BE_CRUD_NOTIF --> DB

    %% Styles
    classDef frontend fill:#cdefff,stroke:#036;
    classDef backend fill:#e0e0e0,stroke:#333;
    classDef db fill:#c8f7c5,stroke:#2d862d,stroke-width:2px;
    classDef tasks fill:#fdebd0,stroke:#d35400;
    classDef external fill:#fcf3cf,stroke:#b7950b;

    %% Click Events
    click FE_MAIN "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/main.jsx"
    click FE_APP "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/App.jsx"
    click FE_LP "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/pages/LandingPage.jsx"
    click FE_LOGIN "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/pages/Login.jsx"
    click FE_REGISTER "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/pages/Register.jsx"
    click FE_ACCOUNT "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/pages/AccountDetails.jsx"
    click FE_HEADER "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/components/Header.jsx"
    click FE_MAP "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/components/Map.jsx"
    click FE_MARKER_DETAIL "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/components/MarkerDetail.jsx"
    click FE_MARKER_FORM "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/components/MarkerForm.jsx"
    click FE_NOTIFICATION "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/components/Notification.jsx"
    click FE_NOTIF_HISTORY "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/components/NotificationsHistory.jsx"
    click FE_PROTECTED "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/components/ProtectedRoute.jsx"
    click FE_SEARCH "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/components/SearchBox.jsx"
    click FE_AXIOS "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/api/axios.js"
    click FE_CONTEXT "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/frontend/src/contexts/NotificationsContext.jsx"
    click BE_MAIN "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/main.py"
    click BE_APP_MAIN "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/main.py"
    click BE_CONFIG "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/core/config.py"
    click BE_SECURITY "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/core/security.py"
    click BE_AUTH "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/routes/auth.py"
    click BE_USERS "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/routes/users.py"
    click BE_TRANSACTION "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/routes/transaction.py"
    click BE_MARKER "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/routes/marker.py"
    click BE_NOTIFICATION_ROUTE "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/routes/notification.py"
    click BE_CRUD_NOTIF "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/crud/notification.py"
    click BE_DB_SESSION "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/db/session.py"
    click BE_DB_BASE "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/db/base_class.py"
    click BE_MODEL_USER "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/models/user.py"
    click BE_MODEL_TRANS "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/models/transaction.py"
    click BE_MODEL_MARKER "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/models/marker.py"
    click BE_MODEL_NOTIF "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/models/notification.py"
    click BE_SCHEMA_USER "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/schemas/user.py"
    click BE_SCHEMA_TRANS "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/schemas/transaction.py"
    click BE_SCHEMA_MARKER "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/schemas/marker.py"
    click BE_SCHEMA_NOTIF "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/schemas/notification.py"
    click BE_TASKS "https://github.com/shounak-ghosh/mobile-food-drive/blob/main/backend/app/tasks.py"
    ```