CREATE TABLE accounts (
 id VARCHAR(36) PRIMARY KEY,
 email VARCHAR(254) NOT NULL UNIQUE,
 password_hash VARCHAR(100) NOT NULL,
 name VARCHAR(80) NOT NULL,
 workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 role VARCHAR(20) NOT NULL CHECK (role IN ('student','faculty','inventory')),
 is_owner BOOLEAN NOT NULL DEFAULT FALSE,
 created_at VARCHAR(40) NOT NULL
);
ALTER TABLE sessions ADD COLUMN account_id VARCHAR(36) REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE requests ADD COLUMN requester_id VARCHAR(36) REFERENCES accounts(id);
CREATE INDEX accounts_workspace ON accounts(workspace_id);
CREATE TABLE invitations (
 id VARCHAR(64) PRIMARY KEY,
 workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 email VARCHAR(254) NOT NULL,
 role VARCHAR(20) NOT NULL CHECK (role IN ('student','faculty','inventory')),
 expires_at VARCHAR(40) NOT NULL,
 used BOOLEAN NOT NULL DEFAULT FALSE
);
