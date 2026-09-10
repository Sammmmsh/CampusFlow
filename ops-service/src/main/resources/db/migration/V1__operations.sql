CREATE TABLE workspaces (
 id VARCHAR(36) PRIMARY KEY, created_at VARCHAR(40) NOT NULL,
 fail_calendar BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE sessions (
 id VARCHAR(64) PRIMARY KEY, workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 role VARCHAR(20) NOT NULL CHECK (role IN ('student','faculty','inventory')), csrf VARCHAR(64) NOT NULL, expires_at VARCHAR(40) NOT NULL
);
CREATE TABLE equipment (
 id INTEGER NOT NULL, workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name VARCHAR(100) NOT NULL, category VARCHAR(50) NOT NULL, location VARCHAR(80) NOT NULL,
 capacity INTEGER NOT NULL CHECK(capacity > 0), description VARCHAR(300) NOT NULL,
 PRIMARY KEY(workspace_id,id)
);
CREATE TABLE requests (
 id VARCHAR(36) PRIMARY KEY, workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 equipment_id INTEGER NOT NULL, title VARCHAR(100) NOT NULL, purpose VARCHAR(1000) NOT NULL,
 requester VARCHAR(80) NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0),
 starts_at VARCHAR(40) NOT NULL, ends_at VARCHAR(40) NOT NULL,
 status VARCHAR(20) NOT NULL CHECK(status IN ('pending','approved','allocated','collected','returned','rejected','cancelled')),
 created_at VARCHAR(40) NOT NULL, updated_at VARCHAR(40) NOT NULL,
 decision_note VARCHAR(500) NOT NULL DEFAULT '', idempotency_key VARCHAR(80) NOT NULL,
 FOREIGN KEY(workspace_id,equipment_id) REFERENCES equipment(workspace_id,id),
 UNIQUE(workspace_id,idempotency_key)
);
CREATE INDEX requests_workspace_status ON requests(workspace_id,status);
CREATE INDEX requests_reservations ON requests(workspace_id,equipment_id,starts_at,ends_at,status);
CREATE TABLE audit_events (
 id VARCHAR(36) PRIMARY KEY, workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 request_id VARCHAR(36) NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
 actor VARCHAR(80) NOT NULL, action VARCHAR(30) NOT NULL, detail VARCHAR(1000) NOT NULL, created_at VARCHAR(40) NOT NULL
);
CREATE INDEX audit_workspace_time ON audit_events(workspace_id,created_at);
CREATE TABLE calendar_jobs (
 id VARCHAR(36) PRIMARY KEY, workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 request_id VARCHAR(36) NOT NULL UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
 state VARCHAR(20) NOT NULL CHECK(state IN ('pending','failed','synced')),
 attempts INTEGER NOT NULL DEFAULT 0, last_error VARCHAR(300) NOT NULL DEFAULT '',
 provider_id VARCHAR(100) NOT NULL DEFAULT '', updated_at VARCHAR(40) NOT NULL
);
