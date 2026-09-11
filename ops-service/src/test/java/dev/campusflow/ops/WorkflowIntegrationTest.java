package dev.campusflow.ops;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest(
  properties = {
    "spring.datasource.url=${TEST_DATABASE_URL:jdbc:h2:mem:ops;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1}",
    "ops.dispatch-delay=3600000",
  }
)
@AutoConfigureMockMvc
class WorkflowIntegrationTest {

  @Autowired
  WorkflowService flow;

  @Autowired
  org.springframework.jdbc.core.JdbcTemplate db;

  @Autowired
  CalendarDispatcher calendar;

  @Autowired
  SessionService sessions;

  @Autowired
  MockMvc api;

  WorkflowService.CreateRequest body(String title) {
    return new WorkflowService.CreateRequest(
      1,
      title,
      "Demo society event needs a projector.",
      1,
      Instant.now().plusSeconds(86400 * 40),
      Instant.now().plusSeconds(86400 * 40 + 3600)
    );
  }

  String create(String ws) {
    return flow
      .create(
        ws,
        "student",
        body("Campus showcase"),
        UUID.randomUUID().toString()
      )
      .get("id")
      .toString();
  }

  @Test
  void completeLifecycleKeepsHistory() {
    String ws = flow.seed(),
      id = create(ws);
    for (var step : List.of(
      new String[] { "faculty", "approve" },
      new String[] { "inventory", "allocate" },
      new String[] { "inventory", "collect" },
      new String[] { "inventory", "return" }
    ))
      flow.act(ws, step[0], id, step[1], "");
    assertEquals(
      "returned",
      flow.one("SELECT status FROM requests WHERE id=?", id).get("status")
    );
    assertEquals(
      5,
      db.queryForObject(
        "SELECT COUNT(*) FROM audit_events WHERE request_id=?",
        Integer.class,
        id
      )
    );
  }

  @Test
  void studentCannotApproveEvenThroughApi() {
    String ws = flow.seed(),
      id = create(ws);
    var error = assertThrows(ResponseStatusException.class, () ->
      flow.act(ws, "student", id, "approve", "")
    );
    assertEquals(403, error.getStatusCode().value());
  }

  @Test
  void identicalRetriesReturnOneRequest() {
    String ws = flow.seed();
    var b = body("Idempotency check");
    var a = flow.create(ws, "student", b, "same-key-123");
    var c = flow.create(ws, "student", b, "same-key-123");
    assertEquals(a.get("id"), c.get("id"));
    assertEquals(
      1,
      db.queryForObject(
        "SELECT COUNT(*) FROM requests WHERE workspace_id=? AND idempotency_key='same-key-123'",
        Integer.class,
        ws
      )
    );
  }

  @Test
  void reusedKeyWithDifferentPayloadIsRejected() {
    String ws = flow.seed();
    flow.create(ws, "student", body("First title"), "same-key-456");
    assertEquals(
      409,
      assertThrows(ResponseStatusException.class, () ->
        flow.create(ws, "student", body("Different title"), "same-key-456")
      )
        .getStatusCode()
        .value()
    );
  }

  @Test
  void concurrentApprovalsCannotDoubleBookLastProjector() throws Exception {
    String ws = flow.seed(),
      first = create(ws),
      second = create(ws);
    var pool = Executors.newFixedThreadPool(2);
    try {
      var gate = new CountDownLatch(1);
      List<Future<Integer>> tasks = new ArrayList<>();
      for (String id : List.of(first, second))
        tasks.add(
          pool.submit(() -> {
            gate.await();
            try {
              flow.act(ws, "faculty", id, "approve", "");
              return 200;
            } catch (ResponseStatusException e) {
              return e.getStatusCode().value();
            }
          })
        );
      gate.countDown();
      var results = new ArrayList<Integer>();
      for (var f : tasks) results.add(f.get(15, TimeUnit.SECONDS));
      Collections.sort(results);
      assertEquals(List.of(200, 409), results);
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  void calendarFailureDoesNotUndoApprovalAndRetryDoesNotDuplicate() {
    String ws = flow.seed(),
      id = create(ws);
    db.update("UPDATE workspaces SET fail_calendar=TRUE WHERE id=?", ws);
    flow.act(ws, "faculty", id, "approve", "");
    String job = db.queryForObject(
      "SELECT id FROM calendar_jobs WHERE request_id=?",
      String.class,
      id
    );
    calendar.dispatch(job);
    assertEquals(
      "approved",
      flow.one("SELECT status FROM requests WHERE id=?", id).get("status")
    );
    assertEquals(
      "failed",
      flow.one("SELECT state FROM calendar_jobs WHERE id=?", job).get("state")
    );
    db.update("UPDATE workspaces SET fail_calendar=FALSE WHERE id=?", ws);
    calendar.dispatch(job);
    calendar.dispatch(job);
    assertEquals(
      2,
      db.queryForObject(
        "SELECT attempts FROM calendar_jobs WHERE id=?",
        Integer.class,
        job
      )
    );
    assertEquals(
      "synced",
      flow.one("SELECT state FROM calendar_jobs WHERE id=?", job).get("state")
    );
  }

  @Test
  void workspaceIsolation() {
    String one = flow.seed(),
      two = flow.seed(),
      id = create(one);
    assertEquals(
      404,
      assertThrows(ResponseStatusException.class, () ->
        flow.act(two, "faculty", id, "approve", "")
      )
        .getStatusCode()
        .value()
    );
  }

  @Test
  void invalidTransitionsAndEmptyRejectionAreRejected() {
    String ws = flow.seed(),
      id = create(ws);
    assertEquals(
      409,
      assertThrows(ResponseStatusException.class, () ->
        flow.act(ws, "inventory", id, "return", "")
      )
        .getStatusCode()
        .value()
    );
    assertEquals(
      400,
      assertThrows(ResponseStatusException.class, () ->
        flow.act(ws, "faculty", id, "reject", "")
      )
        .getStatusCode()
        .value()
    );
    flow.act(ws, "faculty", id, "reject", "Please choose a different date.");
    assertEquals(
      "Please choose a different date.",
      flow
        .one("SELECT decision_note FROM requests WHERE id=?", id)
        .get("decision_note")
    );
  }

  @Test
  void csrfAndUnauthenticatedApiRequestsAreBlocked() throws Exception {
    api.perform(get("/api/ops/dashboard")).andExpect(status().isUnauthorized());
    api
      .perform(
        post("/api/ops/session")
          .contentType(MediaType.APPLICATION_JSON)
          .content("{}")
      )
      .andExpect(status().isForbidden());
    var s = sessions.start("student");
    api
      .perform(
        post("/api/ops/session/role")
          .cookie(
            new jakarta.servlet.http.Cookie("cf_ops", s.get("token").toString())
          )
          .contentType(MediaType.APPLICATION_JSON)
          .content("{\"role\":\"faculty\"}")
      )
      .andExpect(status().isForbidden());
  }

  @Test
  void sessionRotationDoesNotAcceptForgedCookie() throws Exception {
    api
      .perform(
        get("/api/ops/dashboard").cookie(
          new jakarta.servlet.http.Cookie("cf_ops", "a".repeat(64))
        )
      )
      .andExpect(status().isUnauthorized());
  }

  @Test
  void rangeAndInventoryValidation() {
    String ws = flow.seed();
    var now = Instant.now();
    var b = new WorkflowService.CreateRequest(
      1,
      "A valid title",
      "A sufficiently detailed purpose",
      2,
      now.plusSeconds(3600),
      now.plusSeconds(7200)
    );
    assertEquals(
      400,
      assertThrows(ResponseStatusException.class, () ->
        flow.create(ws, "student", b, "inventory-key-1")
      )
        .getStatusCode()
        .value()
    );
  }

  @Test
  void sessionCookieIsHttpOnlyAndCrossOriginBootstrapIsBlocked()
    throws Exception {
    api
      .perform(
        post("/api/ops/session")
          .header("X-CampusFlow", "1")
          .header("Origin", "https://untrusted.example")
          .contentType(MediaType.APPLICATION_JSON)
          .content("{}")
      )
      .andExpect(status().isForbidden());
    api
      .perform(
        post("/api/ops/session")
          .header("X-CampusFlow", "1")
          .contentType(MediaType.APPLICATION_JSON)
          .content("{}")
      )
      .andExpect(status().isOk())
      .andExpect(
        header().string(
          "Set-Cookie",
          org.hamcrest.Matchers.containsString("HttpOnly")
        )
      );
  }

  String timedRequest(String ws, int equipment, Instant start, Instant end) {
    return flow
      .create(
        ws,
        "student",
        new WorkflowService.CreateRequest(
          equipment,
          "Timing check",
          "A club event with equipment requirements.",
          1,
          start,
          end
        ),
        UUID.randomUUID().toString()
      )
      .get("id")
      .toString();
  }

  @Test
  void adjacentBookingsUsePeakCapacityRatherThanSumOfOverlaps() {
    String ws = flow.seed();
    Instant start = Instant.now().plusSeconds(86400 * 50);
    String first = timedRequest(ws, 2, start, start.plusSeconds(3600));
    String second = timedRequest(
      ws,
      2,
      start.plusSeconds(3600),
      start.plusSeconds(7200)
    );
    String spanning = timedRequest(ws, 2, start, start.plusSeconds(7200));
    for (String id : List.of(first, second, spanning))
      flow.act(ws, "faculty", id, "approve", "");
    String excess = timedRequest(ws, 2, start, start.plusSeconds(7200));
    assertEquals(
      409,
      assertThrows(ResponseStatusException.class, () ->
        flow.act(ws, "faculty", excess, "approve", "")
      )
        .getStatusCode()
        .value()
    );
  }

  @Test
  void outstandingCollectionBlocksAnotherUntilReturn() {
    String ws = flow.seed();
    Instant start = Instant.now().plusSeconds(86400 * 50);
    String first = timedRequest(ws, 1, start, start.plusSeconds(3600));
    String second = timedRequest(
      ws,
      1,
      start.plusSeconds(3600),
      start.plusSeconds(7200)
    );
    for (String id : List.of(first, second)) {
      flow.act(ws, "faculty", id, "approve", "");
      flow.act(ws, "inventory", id, "allocate", "");
    }
    flow.act(ws, "inventory", first, "collect", "");
    assertEquals(
      409,
      assertThrows(ResponseStatusException.class, () ->
        flow.act(ws, "inventory", second, "collect", "")
      )
        .getStatusCode()
        .value()
    );
    flow.act(ws, "inventory", first, "return", "");
    flow.act(ws, "inventory", second, "collect", "");
    assertEquals(
      "collected",
      flow.one("SELECT status FROM requests WHERE id=?", second).get("status")
    );
  }

  @Test
  void bookingLimitRejectsFourteenDaysAndOneSecond() {
    String ws = flow.seed();
    Instant start = Instant.now().plusSeconds(86400 * 50);
    assertEquals(
      400,
      assertThrows(ResponseStatusException.class, () ->
        timedRequest(ws, 1, start, start.plusSeconds(14 * 86400 + 1))
      )
        .getStatusCode()
        .value()
    );
  }
}
