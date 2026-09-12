package dev.campusflow.ops;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest(
  properties = {
    "spring.datasource.url=${TEST_DATABASE_URL:jdbc:h2:mem:auth;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1}",
    "ops.dispatch-delay=3600000",
  }
)
@AutoConfigureMockMvc
class AuthIntegrationTest {

  @Autowired
  AuthService auth;

  @Autowired
  SessionService sessions;

  @Autowired
  WorkflowService flow;

  @Autowired
  JdbcTemplate db;

  @Autowired
  MockMvc api;

  @Autowired
  ObjectMapper json;

  final String password = "A-long-test-password-42";

  String email() {
    return UUID.randomUUID() + "@example.test";
  }

  Map<String, Object> owner() {
    return auth.register(email(), "Test Owner", password, "");
  }

  Map<String, Object> session(Map<String, Object> data) {
    return sessions.lookup(data.get("token").toString());
  }

  Map<String, Object> member(
    Map<String, Object> owner,
    String name,
    String role
  ) {
    String email = email();
    var invite = auth.invite(session(owner), email, role);
    return auth.register(email, name, password, invite.get("code").toString());
  }

  @Test
  void passwordsAreHashedAndLoginRestoresWorkspace() {
    String email = email();
    var first = auth.register(email, "Ada", password, "");
    var a = db.queryForMap("SELECT * FROM accounts WHERE email=?", email);
    assertNotEquals(password, a.get("password_hash"));
    assertTrue(a.get("password_hash").toString().startsWith("$2"));
    var next = auth.login(email.toUpperCase(Locale.ROOT), password);
    assertEquals(
      session(first).get("workspace_id"),
      session(next).get("workspace_id")
    );
    assertNotEquals(first.get("token"), next.get("token"));
    assertEquals(false, next.get("demo"));
    assertThrows(ResponseStatusException.class, () ->
      auth.login(email, "incorrect-password")
    );
  }

  @Test
  void invitationIsBoundToEmailSingleUseAndAssignedRole() {
    var owner = owner();
    String email = email();
    var invite = auth.invite(session(owner), email, "student");
    String code = invite.get("code").toString();
    assertThrows(ResponseStatusException.class, () ->
      auth.register(email(), "Wrong person", password, code)
    );
    var person = auth.register(email, "Student", password, code);
    assertEquals("student", person.get("role"));
    assertEquals(false, person.get("owner"));
    assertEquals(
      session(owner).get("workspace_id"),
      session(person).get("workspace_id")
    );
    assertThrows(ResponseStatusException.class, () ->
      sessions.role(session(person), "faculty")
    );
    assertThrows(ResponseStatusException.class, () ->
      auth.invite(session(person), email(), "faculty")
    );
    assertThrows(ResponseStatusException.class, () ->
      auth.register(email(), "Reused", password, code)
    );
  }

  @Test
  void expiredInvitationCannotCreateMembership() {
    var invite = auth.invite(session(owner()), email(), "inventory");
    db.update(
      "UPDATE invitations SET expires_at=? WHERE id=?",
      WorkflowService.time(Instant.now().minusSeconds(1)),
      SessionService.hash(invite.get("code").toString())
    );
    assertThrows(ResponseStatusException.class, () ->
      auth.register(
        invite.get("email").toString(),
        "Expired",
        password,
        invite.get("code").toString()
      )
    );
  }

  @Test
  void ownerWorkspacesSurviveDemoCleanup() {
    var owner = owner();
    String ws = session(owner).get("workspace_id").toString();
    db.update(
      "UPDATE workspaces SET created_at=? WHERE id=?",
      WorkflowService.time(Instant.now().minusSeconds(9 * 86400)),
      ws
    );
    sessions.start("student");
    assertEquals(ws, session(owner).get("workspace_id"));
    assertEquals(
      0,
      db.queryForObject(
        "SELECT COUNT(*) FROM requests WHERE workspace_id=?",
        Integer.class,
        ws
      )
    );
  }

  @Test
  void sameNameMembersCannotCancelEachOthersRequests() {
    var owner = owner();
    var a = session(member(owner, "Same Name", "student"));
    var b = session(member(owner, "Same Name", "student"));
    String ws = a.get("workspace_id").toString();
    var body = new WorkflowService.CreateRequest(
      1,
      "Team presentation",
      "A proper purpose for the equipment",
      1,
      Instant.now().plusSeconds(3600),
      Instant.now().plusSeconds(7200)
    );
    String id = flow
      .create(
        ws,
        "student",
        body,
        UUID.randomUUID().toString(),
        "Same Name",
        a.get("account_id").toString()
      )
      .get("id")
      .toString();
    assertThrows(ResponseStatusException.class, () ->
      flow.act(
        ws,
        "student",
        id,
        "cancel",
        "",
        "Same Name",
        b.get("account_id").toString()
      )
    );
    assertEquals(
      "cancelled",
      flow
        .act(
          ws,
          "student",
          id,
          "cancel",
          "",
          "Same Name",
          a.get("account_id").toString()
        )
        .get("status")
    );
  }

  @Test
  void passwordChangeRevokesOldSessions() {
    String email = email();
    var first = auth.register(email, "Password user", password, "");
    var second = auth.login(email, password);
    var updated = auth.changePassword(
      session(first),
      password,
      "Another-long-password-53"
    );
    assertThrows(ResponseStatusException.class, () -> session(first));
    assertThrows(ResponseStatusException.class, () -> session(second));
    assertEquals(false, updated.get("demo"));
    assertNotNull(session(updated));
    assertThrows(ResponseStatusException.class, () ->
      auth.login(email, password)
    );
  }

  @Test
  void authHttpRequiresOriginHeaderGuardAndLogoutRevokesCookie()
    throws Exception {
    String body = json.writeValueAsString(
      Map.of(
        "email",
        email(),
        "name",
        "Http User",
        "password",
        password,
        "role",
        "inventory"
      )
    );
    api
      .perform(
        post("/api/ops/auth/register")
          .contentType(MediaType.APPLICATION_JSON)
          .content(body)
      )
      .andExpect(status().isForbidden());
    api
      .perform(
        post("/api/ops/auth/register")
          .header("X-CampusFlow", "1")
          .header("Origin", "https://untrusted.example")
          .contentType(MediaType.APPLICATION_JSON)
          .content(body)
      )
      .andExpect(status().isForbidden());
    var result = api
      .perform(
        post("/api/ops/auth/register")
          .header("X-CampusFlow", "1")
          .contentType(MediaType.APPLICATION_JSON)
          .content(body)
      )
      .andExpect(status().isOk())
      .andReturn();
    String setCookie = result.getResponse().getHeader("Set-Cookie");
    assertTrue(setCookie.contains("HttpOnly"));
    Cookie cookie = new Cookie(
      "cf_ops",
      setCookie.split(";")[0].substring("cf_ops=".length())
    );
    var data = json.readTree(result.getResponse().getContentAsString());
    assertEquals("faculty", data.get("role").asText());
    api
      .perform(
        post("/api/ops/auth/logout")
          .cookie(cookie)
          .contentType(MediaType.APPLICATION_JSON)
          .content("{}")
      )
      .andExpect(status().isForbidden());
    api
      .perform(
        post("/api/ops/auth/logout")
          .cookie(cookie)
          .header("X-CSRF-Token", data.get("csrf").asText())
          .contentType(MediaType.APPLICATION_JSON)
          .content("{}")
      )
      .andExpect(status().isOk());
    api
      .perform(get("/api/ops/dashboard").cookie(cookie))
      .andExpect(status().isUnauthorized());
  }

  @Test
  void shortPasswordsAndRepeatedLoginAttemptsAreRejected() {
    assertThrows(ResponseStatusException.class, () ->
      auth.register(email(), "Name", "short", "")
    );
    AuthThrottle limiter = new AuthThrottle();
    for (int i = 0; i < 12; i++) limiter.check("test-ip", "user@example.test");
    assertThrows(ResponseStatusException.class, () ->
      limiter.check("test-ip", "user@example.test")
    );
  }

  @Test
  void malformedCredentialsReturnClientErrors() throws Exception {
    String email = email();
    var owner = auth.register(email, "Input checks", password, "");
    assertEquals(401, assertThrows(ResponseStatusException.class, () ->
      auth.login(email, "界".repeat(30))).getStatusCode().value());
    assertEquals(401, assertThrows(ResponseStatusException.class, () ->
      auth.changePassword(session(owner), "界".repeat(30), password)).getStatusCode().value());
    assertEquals(400, assertThrows(ResponseStatusException.class, () ->
      auth.invite(session(owner), email(), null)).getStatusCode().value());
    api.perform(post("/api/ops/auth/login")
      .header("X-CampusFlow", "1")
      .contentType(MediaType.APPLICATION_JSON)
      .content("{\"email\":null,\"password\":null}"))
      .andExpect(status().isBadRequest());
  }
}
