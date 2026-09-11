package dev.campusflow.ops;

import static dev.campusflow.ops.WorkflowService.*;
import static org.springframework.http.HttpStatus.*;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/ops")
public class OpsController {

  final SessionService sessions;
  final WorkflowService flow;
  final CalendarDispatcher dispatcher;
  final boolean secure, demo;
  final org.springframework.jdbc.core.JdbcTemplate db;

  public OpsController(
    SessionService sessions,
    WorkflowService flow,
    CalendarDispatcher dispatcher,
    org.springframework.jdbc.core.JdbcTemplate db,
    @Value("${ops.cookie-secure}") boolean secure,
    @Value("${ops.demo-enabled}") boolean demo
  ) {
    this.sessions = sessions;
    this.flow = flow;
    this.dispatcher = dispatcher;
    this.secure = secure;
    this.demo = demo;
    this.db = db;
  }

  @SuppressWarnings("unchecked")
  Map<String, Object> session(HttpServletRequest r) {
    return (Map<String, Object>) r.getAttribute("opsSession");
  }

  @PostMapping("/session")
  public Map<String, Object> start(
    @RequestBody Map<String, String> b,
    HttpServletResponse res
  ) {
    require(demo, FORBIDDEN, "The public demo is disabled on this service.");
    var data = new HashMap<>(sessions.start(b.getOrDefault("role", "student")));
    res.addHeader(
      "Set-Cookie",
      ResponseCookie.from("cf_ops", data.remove("token").toString())
        .httpOnly(true)
        .secure(secure)
        .sameSite("Lax")
        .path("/api/ops")
        .maxAge(86400)
        .build()
        .toString()
    );
    return data;
  }

  @GetMapping("/session")
  public Map<String, Object> me(HttpServletRequest req) {
    var s = session(req);
    return Map.of(
      "role",
      s.get("role"),
      "csrf",
      s.get("csrf"),
      "name",
      actor(s.get("role").toString()),
      "demo",
      true
    );
  }

  @PostMapping("/session/role")
  public Map<String, Object> change(
    @RequestBody Map<String, String> b,
    HttpServletRequest req
  ) {
    require(demo, FORBIDDEN, "Demo role switching is disabled.");
    sessions.role(session(req), b.getOrDefault("role", ""));
    return Map.of("ok", true);
  }

  @GetMapping("/dashboard")
  public Map<String, Object> dashboard(HttpServletRequest req) {
    var s = session(req);
    var data = new HashMap<>(
      flow.snapshot(s.get("workspace_id").toString(), s.get("role").toString())
    );
    data.put("calendarMode", dispatcher.mode());
    data.put(
      "calendarFailure",
      db.queryForObject(
        "SELECT fail_calendar FROM workspaces WHERE id=?",
        Boolean.class,
        s.get("workspace_id")
      )
    );
    return data;
  }

  @PostMapping("/requests")
  @ResponseStatus(CREATED)
  public Map<String, Object> create(
    @Valid @RequestBody WorkflowService.CreateRequest body,
    @RequestHeader(value = "Idempotency-Key", required = false) String key,
    HttpServletRequest req
  ) {
    var s = session(req);
    return flow.create(
      s.get("workspace_id").toString(),
      s.get("role").toString(),
      body,
      key
    );
  }

  @PostMapping("/requests/{id}/{action}")
  public Map<String, Object> act(
    @PathVariable String id,
    @PathVariable String action,
    @RequestBody Map<String, String> b,
    HttpServletRequest req
  ) {
    var s = session(req);
    return flow.act(
      s.get("workspace_id").toString(),
      s.get("role").toString(),
      id,
      action,
      b.getOrDefault("note", "")
    );
  }

  @PostMapping("/integrations/retry")
  public Map<String, Object> retry(HttpServletRequest req) {
    var s = session(req);
    require(
      !s.get("role").equals("student"),
      FORBIDDEN,
      "Faculty or inventory access is required."
    );
    var ids = db.queryForList(
      "SELECT id FROM calendar_jobs WHERE workspace_id=? AND state <> 'synced'",
      String.class,
      s.get("workspace_id")
    );
    for (String id : ids) dispatcher.dispatch(id);
    return Map.of("processed", ids.size());
  }

  @PostMapping("/integrations/failure")
  public Map<String, Object> failure(
    @RequestBody Map<String, Boolean> b,
    HttpServletRequest req
  ) {
    var s = session(req);
    require(
      !s.get("role").equals("student"),
      FORBIDDEN,
      "Faculty or inventory access is required."
    );
    require(
      dispatcher.mode().equals("demo"),
      BAD_REQUEST,
      "Failure simulation is available only with the demo provider."
    );
    db.update(
      "UPDATE workspaces SET fail_calendar=? WHERE id=?",
      b.getOrDefault("enabled", false),
      s.get("workspace_id")
    );
    return Map.of("ok", true);
  }
}

@RestControllerAdvice
class ApiErrors {

  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<?> status(ResponseStatusException e) {
    return ResponseEntity.status(e.getStatusCode()).body(
      Map.of(
        "message",
        e.getReason() == null ? "Request failed." : e.getReason()
      )
    );
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<?> validation(MethodArgumentNotValidException e) {
    return ResponseEntity.badRequest().body(
      Map.of("message", "Please check the required fields and their limits.")
    );
  }

  @ExceptionHandler(
    org.springframework.http.converter.HttpMessageNotReadableException.class
  )
  ResponseEntity<?> malformed() {
    return ResponseEntity.badRequest().body(
      Map.of("message", "Please enter valid dates and quantities.")
    );
  }
}
