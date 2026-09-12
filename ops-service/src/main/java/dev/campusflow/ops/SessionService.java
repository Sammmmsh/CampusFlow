package dev.campusflow.ops;

import static dev.campusflow.ops.WorkflowService.*;
import static org.springframework.http.HttpStatus.*;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionService {

  final JdbcTemplate db;
  final WorkflowService workflow;

  public SessionService(JdbcTemplate db, WorkflowService workflow) {
    this.db = db;
    this.workflow = workflow;
  }

  static String token() {
    byte[] bytes = new byte[32];
    new SecureRandom().nextBytes(bytes);
    return HexFormat.of().formatHex(bytes);
  }

  static String hash(String value) {
    try {
      return HexFormat.of().formatHex(
        MessageDigest.getInstance("SHA-256").digest(
          value.getBytes(StandardCharsets.UTF_8)
        )
      );
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  @Transactional
  public Map<String, Object> start(String role) {
    require(
      role != null && List.of("student", "faculty", "inventory").contains(role),
      BAD_REQUEST,
      "Choose a valid demo role."
    );
    db.update(
      "DELETE FROM workspaces WHERE created_at < ? AND NOT EXISTS (SELECT 1 FROM accounts WHERE accounts.workspace_id=workspaces.id)",
      time(Instant.now().minusSeconds(7 * 86400))
    );
    require(
      db.queryForObject("SELECT COUNT(*) FROM workspaces", Integer.class) <
        2000,
      TOO_MANY_REQUESTS,
      "The demo is busy. Please try again later."
    );
    String ws = workflow.seed(),
      token = token(),
      csrf = token();
    db.update(
      "INSERT INTO sessions(id,workspace_id,role,csrf,expires_at) VALUES (?,?,?,?,?)",
      hash(token),
      ws,
      role,
      csrf,
      time(Instant.now().plusSeconds(86400))
    );
    return Map.of(
      "token",
      token,
      "csrf",
      csrf,
      "workspace",
      ws,
      "role",
      role,
      "name",
      actor(role),
      "demo",
      true
    );
  }

  public Map<String, Object> lookup(String token) {
    require(
      token != null && token.matches("[a-f0-9]{64}"),
      UNAUTHORIZED,
      "Sign in or open a sample workspace to continue."
    );
    var sessions = db.queryForList(
      "SELECT s.*,a.name AS account_name,a.is_owner FROM sessions s LEFT JOIN accounts a ON a.id=s.account_id WHERE s.id=? AND s.expires_at > ?",
      hash(token),
      now()
    );
    require(
      !sessions.isEmpty(),
      UNAUTHORIZED,
      "Your session expired. Sign in again or open a sample workspace."
    );
    return sessions.get(0);
  }

  public void role(Map<String, Object> session, String role) {
    require(
      session.get("account_id") == null ||
        Boolean.TRUE.equals(session.get("is_owner")),
      FORBIDDEN,
      "Your role is assigned by the workspace owner."
    );
    require(
      role != null && List.of("student", "faculty", "inventory").contains(role),
      BAD_REQUEST,
      "Choose a valid workspace role."
    );
    db.update("UPDATE sessions SET role=? WHERE id=?", role, session.get("id"));
  }

  public Map<String, Object> account(String accountId) {
    var a = db.queryForMap("SELECT * FROM accounts WHERE id=?", accountId);
    db.update("DELETE FROM sessions WHERE expires_at < ?", now());
    String token = token(),
      csrf = token();
    db.update(
      "INSERT INTO sessions(id,workspace_id,role,csrf,expires_at,account_id) VALUES (?,?,?,?,?,?)",
      hash(token),
      a.get("workspace_id"),
      a.get("role"),
      csrf,
      time(Instant.now().plusSeconds(86400)),
      accountId
    );
    return Map.of(
      "token",
      token,
      "csrf",
      csrf,
      "role",
      a.get("role"),
      "name",
      a.get("name"),
      "demo",
      false,
      "owner",
      a.get("is_owner")
    );
  }

  public void end(String rawToken) {
    if (rawToken != null && rawToken.matches("[a-f0-9]{64}")) db.update(
      "DELETE FROM sessions WHERE id=?",
      hash(rawToken)
    );
  }
}
