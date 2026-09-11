package dev.campusflow.ops;

import static org.springframework.http.HttpStatus.*;

import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkflowService {

  final JdbcTemplate db;

  public WorkflowService(JdbcTemplate db) {
    this.db = db;
  }

  static String id() {
    return UUID.randomUUID().toString();
  }

  static String time(Instant value) {
    return new java.time.format.DateTimeFormatterBuilder()
      .appendInstant(9)
      .toFormatter()
      .format(value);
  }

  static String now() {
    return time(Instant.now());
  }

  static String actor(String role) {
    return switch (role) {
      case "student" -> "Maya Shah";
      case "faculty" -> "Dr. Iyer";
      default -> "Arjun Rao";
    };
  }

  static void require(
    boolean condition,
    org.springframework.http.HttpStatus status,
    String message
  ) {
    if (!condition) throw new ResponseStatusException(status, message);
  }

  Map<String, Object> one(String sql, Object... args) {
    var rows = db.queryForList(sql, args);
    require(!rows.isEmpty(), NOT_FOUND, "This item is not in your workspace.");
    return rows.get(0);
  }

  @Transactional
  public String seed() {
    String ws = id();
    db.update("INSERT INTO workspaces(id,created_at) VALUES (?,?)", ws, now());
    Object[][] items = {
      {
        1,
        "Epson classroom projector",
        "Presentation",
        "Academic block · Room 102",
        1,
        "Bring your ideas to the big screen. HDMI cable and remote included.",
      },
      {
        2,
        "Canon EOS camera kit",
        "Photography",
        "Media lab · Ground floor",
        2,
        "For the moments worth keeping. Includes a lens, battery and tripod.",
      },
      {
        3,
        "JBL portable speaker",
        "Audio",
        "Student centre · Equipment desk",
        3,
        "A little more volume for your next campus gathering.",
      },
      {
        4,
        "Wireless microphone set",
        "Audio",
        "Auditorium · Green room",
        2,
        "Two handheld microphones, receiver and a fresh set of batteries.",
      },
      {
        5,
        "Arduino learning kit",
        "Electronics",
        "Innovation lab · Room 204",
        8,
        "Build, experiment, repeat. Board, breadboard and components included.",
      },
      {
        6,
        "Presentation clicker",
        "Presentation",
        "Library · Help desk",
        4,
        "One less thing to worry about during your presentation.",
      },
    };
    for (Object[] e : items)
      db.update(
        "INSERT INTO equipment VALUES (?,?,?,?,?,?,?)",
        e[0],
        ws,
        e[1],
        e[2],
        e[3],
        e[4],
        e[5]
      );
    seedRequest(
      ws,
      1,
      "Design society showcase",
      "Present our student design projects at the weekly society meetup.",
      "Maya Shah",
      "pending",
      1,
      2
    );
    seedRequest(
      ws,
      2,
      "A day on campus",
      "Photograph student clubs for our campus newsletter.",
      "Maya Shah",
      "approved",
      1,
      3
    );
    seedRequest(
      ws,
      3,
      "Friday open mic",
      "A welcoming evening for first-time performers.",
      "Maya Shah",
      "allocated",
      1,
      1
    );
    seedRequest(
      ws,
      5,
      "Build night: first circuits",
      "Hands-on introduction to electronics for new club members.",
      "Maya Shah",
      "collected",
      2,
      -1
    );
    seedRequest(
      ws,
      4,
      "Student council town hall",
      "Make sure every question can be heard.",
      "Maya Shah",
      "returned",
      1,
      -3
    );
    return ws;
  }

  void seedRequest(
    String ws,
    int equipment,
    String title,
    String purpose,
    String person,
    String status,
    int quantity,
    int day
  ) {
    String rid = id(),
      stamp = now();
    Instant start = LocalDate.now(ZoneOffset.UTC)
      .plusDays(day)
      .atTime(10, 0)
      .toInstant(ZoneOffset.UTC);
    db.update(
      "INSERT INTO requests VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      rid,
      ws,
      equipment,
      title,
      purpose,
      person,
      quantity,
      time(start),
      time(start.plusSeconds(7200)),
      status,
      stamp,
      stamp,
      "",
      "seed-" + rid
    );
    audit(
      ws,
      rid,
      "CampusFlow",
      "created",
      "Sample request added to your private demo."
    );
    if (!status.equals("pending")) audit(
      ws,
      rid,
      "Dr. Iyer",
      "approved",
      "Equipment approved for the campus event."
    );
    if (List.of("allocated", "collected", "returned").contains(status)) audit(
      ws,
      rid,
      "Arjun Rao",
      "allocated",
      "Equipment prepared at the collection desk."
    );
    if (List.of("collected", "returned").contains(status)) audit(
      ws,
      rid,
      "Arjun Rao",
      "collected",
      "Collection recorded at the equipment desk."
    );
    if (status.equals("returned")) audit(
      ws,
      rid,
      "Arjun Rao",
      "returned",
      "Equipment returned and checked."
    );
  }

  public Map<String, Object> snapshot(String ws, String role) {
    var equipment = db.queryForList(
      "SELECT * FROM equipment WHERE workspace_id=? ORDER BY id",
      ws
    );
    var requests = db.queryForList(
      "SELECT r.*, e.name AS equipment_name,e.category,e.location FROM requests r JOIN equipment e ON r.equipment_id=e.id AND r.workspace_id=e.workspace_id WHERE r.workspace_id=? ORDER BY r.created_at DESC,r.id",
      ws
    );
    var events = db.queryForList(
      "SELECT a.*,r.title FROM audit_events a JOIN requests r ON a.request_id=r.id WHERE a.workspace_id=? ORDER BY a.created_at DESC LIMIT 200",
      ws
    );
    var jobs = db.queryForList(
      "SELECT j.*,r.title FROM calendar_jobs j JOIN requests r ON j.request_id=r.id WHERE j.workspace_id=? ORDER BY j.updated_at DESC",
      ws
    );
    return Map.of(
      "equipment",
      equipment,
      "requests",
      requests,
      "events",
      events,
      "jobs",
      jobs,
      "role",
      role,
      "name",
      actor(role),
      "demo",
      true
    );
  }

  @Transactional
  public Map<String, Object> create(
    String ws,
    String role,
    CreateRequest b,
    String key
  ) {
    require(
      role.equals("student"),
      FORBIDDEN,
      "Switch to the student role to submit a request."
    );
    require(
      key != null && key.matches("[A-Za-z0-9_-]{8,80}"),
      BAD_REQUEST,
      "A valid Idempotency-Key is required."
    );
    // Serializes repeat submissions before checking the unique key.
    one("SELECT id FROM workspaces WHERE id=? FOR UPDATE", ws);
    var existing = db.queryForList(
      "SELECT * FROM requests WHERE workspace_id=? AND idempotency_key=?",
      ws,
      key
    );
    if (!existing.isEmpty()) {
      var r = existing.get(0);
      require(
        r.get("title").equals(b.title().trim()) &&
          r.get("purpose").equals(b.purpose().trim()) &&
          ((Number) r.get("equipment_id")).intValue() == b.equipmentId() &&
          ((Number) r.get("quantity")).intValue() == b.quantity() &&
          r.get("starts_at").equals(time(b.startsAt())) &&
          r.get("ends_at").equals(time(b.endsAt())),
        CONFLICT,
        "This submission key was already used for a different request."
      );
      return r;
    }
    require(
      b.startsAt().isAfter(Instant.now().minusSeconds(60)),
      BAD_REQUEST,
      "Choose a start time in the future."
    );
    require(
      b.endsAt().isAfter(b.startsAt()) &&
        Duration.between(b.startsAt(), b.endsAt()).compareTo(
          Duration.ofDays(14)
        ) <=
        0,
      BAD_REQUEST,
      "Return must be after collection and within 14 days."
    );
    require(
      b.startsAt().isBefore(Instant.now().plusSeconds(180L * 86400)),
      BAD_REQUEST,
      "Book within the next six months."
    );
    var eq = one(
      "SELECT * FROM equipment WHERE workspace_id=? AND id=?",
      ws,
      b.equipmentId()
    );
    require(
      b.quantity() <= ((Number) eq.get("capacity")).intValue(),
      BAD_REQUEST,
      "This quantity exceeds the equipment inventory."
    );
    int count = db.queryForObject(
      "SELECT COUNT(*) FROM requests WHERE workspace_id=?",
      Integer.class,
      ws
    );
    require(
      count < 200,
      TOO_MANY_REQUESTS,
      "This demo has reached 200 requests. Start a new workspace."
    );
    String rid = id(),
      stamp = now();
    db.update(
      "INSERT INTO requests VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      rid,
      ws,
      b.equipmentId(),
      b.title().trim(),
      b.purpose().trim(),
      actor(role),
      b.quantity(),
      time(b.startsAt()),
      time(b.endsAt()),
      "pending",
      stamp,
      stamp,
      "",
      key
    );
    audit(
      ws,
      rid,
      actor(role),
      "created",
      "Requested " + b.quantity() + " × " + eq.get("name") + "."
    );
    return one("SELECT * FROM requests WHERE id=?", rid);
  }

  @Transactional
  public Map<String, Object> act(
    String ws,
    String role,
    String rid,
    String action,
    String note
  ) {
    // Every transition obtains equipment then request lock in the same order.
    var before = one(
      "SELECT * FROM requests WHERE workspace_id=? AND id=?",
      ws,
      rid
    );
    var eq = one(
      "SELECT * FROM equipment WHERE workspace_id=? AND id=? FOR UPDATE",
      ws,
      before.get("equipment_id")
    );
    var r = one(
      "SELECT * FROM requests WHERE workspace_id=? AND id=? FOR UPDATE",
      ws,
      rid
    );
    String from = (String) r.get("status"),
      to = "";
    switch (action) {
      case "approve" -> {
        require(
          role.equals("faculty"),
          FORBIDDEN,
          "Only faculty can approve requests."
        );
        to = "approved";
        require(
          from.equals("pending"),
          CONFLICT,
          "Only pending requests can be approved."
        );
        int reserved = peakReserved(ws, r);
        require(
          reserved + ((Number) r.get("quantity")).intValue() <=
            ((Number) eq.get("capacity")).intValue(),
          CONFLICT,
          "That equipment is already reserved for this time. Choose another slot."
        );
        require(
          Instant.parse((String) r.get("ends_at")).isAfter(Instant.now()),
          CONFLICT,
          "This booking window has already ended."
        );
      }
      case "reject" -> {
        require(
          role.equals("faculty"),
          FORBIDDEN,
          "Only faculty can reject requests."
        );
        require(
          from.equals("pending"),
          CONFLICT,
          "Only pending requests can be rejected."
        );
        require(
          note != null && note.trim().length() >= 5,
          BAD_REQUEST,
          "Please give the student a reason (at least 5 characters)."
        );
        to = "rejected";
      }
      case "allocate" -> {
        require(
          role.equals("inventory"),
          FORBIDDEN,
          "Only the inventory manager can allocate equipment."
        );
        require(
          from.equals("approved"),
          CONFLICT,
          "Approve this request before allocation."
        );
        to = "allocated";
      }
      case "collect" -> {
        require(
          role.equals("inventory"),
          FORBIDDEN,
          "Only the inventory manager can record collection."
        );
        require(
          from.equals("allocated"),
          CONFLICT,
          "Allocate equipment before collection."
        );
        int checkedOut = db.queryForObject(
          "SELECT COALESCE(SUM(quantity),0) FROM requests WHERE workspace_id=? AND equipment_id=? AND status='collected'",
          Integer.class,
          ws,
          r.get("equipment_id")
        );
        require(
          checkedOut + ((Number) r.get("quantity")).intValue() <=
            ((Number) eq.get("capacity")).intValue(),
          CONFLICT,
          "Equipment is still checked out. Record its return before this collection."
        );
        to = "collected";
      }
      case "return" -> {
        require(
          role.equals("inventory"),
          FORBIDDEN,
          "Only the inventory manager can record returns."
        );
        require(
          from.equals("collected"),
          CONFLICT,
          "Only collected equipment can be returned."
        );
        to = "returned";
      }
      case "cancel" -> {
        require(
          role.equals("student") && r.get("requester").equals(actor(role)),
          FORBIDDEN,
          "Only the requester can cancel."
        );
        require(
          from.equals("pending"),
          CONFLICT,
          "Only pending requests can be cancelled."
        );
        to = "cancelled";
      }
      default -> throw new ResponseStatusException(
        BAD_REQUEST,
        "Unknown workflow action."
      );
    }
    String reason = note == null ? "" : note.trim();
    require(
      reason.length() <= 500,
      BAD_REQUEST,
      "Keep the note within 500 characters."
    );
    db.update(
      "UPDATE requests SET status=?,updated_at=?,decision_note=? WHERE id=?",
      to,
      now(),
      reason,
      rid
    );
    audit(
      ws,
      rid,
      actor(role),
      to,
      reason.isEmpty()
        ? "Request moved from " + from + " to " + to + "."
        : reason
    );
    if (to.equals("approved")) db.update(
      "INSERT INTO calendar_jobs VALUES (?,?,?,?,?,?,?,?)",
      id(),
      ws,
      rid,
      "pending",
      0,
      "",
      "",
      now()
    );
    return one("SELECT * FROM requests WHERE id=?", rid);
  }

  // Called while the equipment row is locked. Half-open intervals let adjacent
  // reservations share units; summing all overlaps would reject valid bookings.
  int peakReserved(String ws, Map<String, Object> request) {
    Instant start = Instant.parse((String) request.get("starts_at"));
    Instant end = Instant.parse((String) request.get("ends_at"));
    var overlaps = db.queryForList(
      "SELECT quantity,starts_at,ends_at FROM requests WHERE workspace_id=? AND equipment_id=? AND status IN ('approved','allocated','collected') AND starts_at < ? AND ends_at > ?",
      ws,
      request.get("equipment_id"),
      request.get("ends_at"),
      request.get("starts_at")
    );
    var changes = new TreeMap<Instant, Integer>();
    for (var booking : overlaps) {
      Instant from = Instant.parse((String) booking.get("starts_at"));
      Instant until = Instant.parse((String) booking.get("ends_at"));
      int quantity = ((Number) booking.get("quantity")).intValue();
      changes.merge(
        from.isBefore(start) ? start : from,
        quantity,
        Integer::sum
      );
      changes.merge(until.isAfter(end) ? end : until, -quantity, Integer::sum);
    }
    int active = 0,
      peak = 0;
    for (int delta : changes.values()) {
      active += delta;
      peak = Math.max(peak, active);
    }
    return peak;
  }

  void audit(
    String ws,
    String rid,
    String actor,
    String action,
    String detail
  ) {
    db.update(
      "INSERT INTO audit_events VALUES (?,?,?,?,?,?,?)",
      id(),
      ws,
      rid,
      actor,
      action,
      detail,
      now()
    );
  }

  public record CreateRequest(
    @jakarta.validation.constraints.Min(1) int equipmentId,
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(
      max = 100
    ) String title,
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(
      min = 10,
      max = 1000
    ) String purpose,
    @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(
      20
    ) int quantity,
    @jakarta.validation.constraints.NotNull Instant startsAt,
    @jakarta.validation.constraints.NotNull Instant endsAt
  ) {}
}
