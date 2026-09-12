package dev.campusflow.ops;

import static dev.campusflow.ops.WorkflowService.*;
import static org.springframework.http.HttpStatus.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  private final JdbcTemplate db;
  private final WorkflowService flow;
  private final SessionService sessions;
  private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder(10);
  private final String dummyHash = passwords.encode(SessionService.token());

  public AuthService(
    JdbcTemplate db,
    WorkflowService flow,
    SessionService sessions
  ) {
    this.db = db;
    this.flow = flow;
    this.sessions = sessions;
  }

  static String email(String input) {
    String value = input == null ? "" : input.trim().toLowerCase(Locale.ROOT);
    require(
      value.length() <= 254 && value.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"),
      BAD_REQUEST,
      "Enter a valid email address."
    );
    return value;
  }

  private void password(String value) {
    require(
      value != null &&
        value.length() >= 12 &&
        value.getBytes(StandardCharsets.UTF_8).length <= 72,
      BAD_REQUEST,
      "Use a password of at least 12 characters and at most 72 UTF-8 bytes."
    );
  }

  @Transactional
  public Map<String, Object> register(
    String inputEmail,
    String name,
    String password,
    String invitation
  ) {
    String email = email(inputEmail);
    password(password);
    require(
      name != null && !name.isBlank() && name.trim().length() <= 80,
      BAD_REQUEST,
      "Enter a name of up to 80 characters."
    );
    require(
      db.queryForObject("SELECT COUNT(*) FROM accounts", Integer.class) < 2000,
      TOO_MANY_REQUESTS,
      "Workspace registration is currently full."
    );
    require(
      db.queryForObject(
          "SELECT COUNT(*) FROM accounts WHERE email=?",
          Integer.class,
          email
        ) ==
        0,
      CONFLICT,
      "An account cannot be created with these details. Try signing in."
    );
    String ws, role;
    boolean owner = invitation == null || invitation.isBlank();
    if (owner) {
      ws = flow.seed();
      // A newly created workspace keeps starter inventory, not fictional bookings.
      db.update("DELETE FROM requests WHERE workspace_id=?", ws);
      role = "faculty";
    } else {
      require(
        invitation.matches("[a-f0-9]{64}"),
        BAD_REQUEST,
        "This invitation is invalid or expired."
      );
      var rows = db.queryForList(
        "SELECT * FROM invitations WHERE id=? FOR UPDATE",
        SessionService.hash(invitation)
      );
      require(
        !rows.isEmpty(),
        BAD_REQUEST,
        "This invitation is invalid or expired."
      );
      var invite = rows.get(0);
      require(
        Boolean.FALSE.equals(invite.get("used")) &&
          invite.get("email").equals(email) &&
          Instant.parse(invite.get("expires_at").toString()).isAfter(
            Instant.now()
          ),
        BAD_REQUEST,
        "This invitation is invalid or expired."
      );
      ws = invite.get("workspace_id").toString();
      role = invite.get("role").toString();
      db.update(
        "UPDATE invitations SET used=TRUE WHERE id=?",
        invite.get("id")
      );
    }
    String account = id();
    try {
      db.update(
        "INSERT INTO accounts(id,email,password_hash,name,workspace_id,role,is_owner,created_at) VALUES (?,?,?,?,?,?,?,?)",
        account,
        email,
        passwords.encode(password),
        name.trim(),
        ws,
        role,
        owner,
        now()
      );
    } catch (DuplicateKeyException e) {
      throw new org.springframework.web.server.ResponseStatusException(
        CONFLICT,
        "An account cannot be created with these details. Try signing in."
      );
    }
    return sessions.account(account);
  }

  @Transactional
  public Map<String, Object> login(String inputEmail, String password) {
    String email = email(inputEmail);
    var rows = db.queryForList("SELECT * FROM accounts WHERE email=?", email);
    String hash = rows.isEmpty()
      ? dummyHash
      : rows.get(0).get("password_hash").toString();
    boolean valid =
      password != null &&
      password.getBytes(StandardCharsets.UTF_8).length <= 72 &&
      passwords.matches(password, hash);
    require(
      valid && !rows.isEmpty(),
      UNAUTHORIZED,
      "Email or password is incorrect."
    );
    return sessions.account(rows.get(0).get("id").toString());
  }

  @Transactional
  public Map<String, Object> invite(
    Map<String, Object> session,
    String inputEmail,
    String role
  ) {
    require(
      Boolean.TRUE.equals(session.get("is_owner")),
      FORBIDDEN,
      "Only the workspace owner can invite members."
    );
    String email = email(inputEmail);
    require(
      role != null && List.of("student", "faculty", "inventory").contains(role),
      BAD_REQUEST,
      "Choose a valid team role."
    );
    String ws = session.get("workspace_id").toString();
    db.queryForMap("SELECT id FROM workspaces WHERE id=? FOR UPDATE", ws);
    require(
      db.queryForObject(
          "SELECT COUNT(*) FROM invitations WHERE workspace_id=? AND used=FALSE AND expires_at>?",
          Integer.class,
          ws,
          now()
        ) <
        50,
      TOO_MANY_REQUESTS,
      "There are already 50 active invitations."
    );
    String code = SessionService.token();
    String expires = time(Instant.now().plusSeconds(172800));
    db.update(
      "INSERT INTO invitations VALUES (?,?,?,?,?,FALSE)",
      SessionService.hash(code),
      ws,
      email,
      role,
      expires
    );
    return Map.of(
      "code",
      code,
      "email",
      email,
      "role",
      role,
      "expiresAt",
      expires
    );
  }

  @Transactional
  public Map<String, Object> changePassword(
    Map<String, Object> session,
    String current,
    String replacement
  ) {
    require(
      session.get("account_id") != null,
      FORBIDDEN,
      "Sign in to an account first."
    );
    password(replacement);
    String account = session.get("account_id").toString();
    var row = db.queryForMap(
      "SELECT password_hash FROM accounts WHERE id=? FOR UPDATE",
      account
    );
    require(
      current != null &&
        current.getBytes(StandardCharsets.UTF_8).length <= 72 &&
        passwords.matches(current, row.get("password_hash").toString()),
      UNAUTHORIZED,
      "The current password is incorrect."
    );
    db.update(
      "UPDATE accounts SET password_hash=? WHERE id=?",
      passwords.encode(replacement),
      account
    );
    db.update("DELETE FROM sessions WHERE account_id=?", account);
    return sessions.account(account);
  }
}
