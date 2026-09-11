package dev.campusflow.ops;

import static dev.campusflow.ops.WorkflowService.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CalendarDispatcher {

  final JdbcTemplate db;
  final ObjectMapper json;
  final String calendarId, token;
  final HttpClient http = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(5))
    .build();

  public CalendarDispatcher(
    JdbcTemplate db,
    ObjectMapper json,
    @Value("${ops.calendar-id}") String id,
    @Value("${ops.calendar-token}") String token
  ) {
    this.db = db;
    this.json = json;
    this.calendarId = id;
    this.token = token;
  }

  public String mode() {
    return calendarId.isBlank() || token.isBlank() ? "demo" : "google";
  }

  @Transactional
  public void dispatch(String jobId) {
    var jobs = db.queryForList(
      "SELECT * FROM calendar_jobs WHERE id=? FOR UPDATE",
      jobId
    );
    if (jobs.isEmpty() || jobs.get(0).get("state").equals("synced")) return;
    var job = jobs.get(0);
    String ws = (String) job.get("workspace_id");
    var request = db.queryForMap(
      "SELECT * FROM requests WHERE id=?",
      job.get("request_id")
    );
    String providerId = "cf" + request.get("id").toString().replace("-", "");
    int attempts = ((Number) job.get("attempts")).intValue() + 1;
    try {
      boolean failure = db.queryForObject(
        "SELECT fail_calendar FROM workspaces WHERE id=?",
        Boolean.class,
        ws
      );
      if (failure && mode().equals("demo")) throw new IllegalStateException(
        "Demo calendar is unavailable. Approval is safely saved; retry after recovery."
      );
      if (mode().equals("google")) {
        var payload = Map.of(
          "id",
          providerId,
          "summary",
          request.get("title"),
          "description",
          request.get("purpose"),
          "start",
          Map.of("dateTime", request.get("starts_at")),
          "end",
          Map.of("dateTime", request.get("ends_at"))
        );
        String url =
          "https://www.googleapis.com/calendar/v3/calendars/" +
          URLEncoder.encode(calendarId, StandardCharsets.UTF_8) +
          "/events";
        var call = HttpRequest.newBuilder(URI.create(url))
          .timeout(Duration.ofSeconds(10))
          .header("Authorization", "Bearer " + token)
          .header("Content-Type", "application/json")
          .POST(
            HttpRequest.BodyPublishers.ofString(
              json.writeValueAsString(payload)
            )
          )
          .build();
        var response = http.send(call, HttpResponse.BodyHandlers.discarding());
        // A deterministic event ID makes retries after a lost response safe.
        if (
          response.statusCode() != 409 &&
          (response.statusCode() < 200 || response.statusCode() > 299)
        ) throw new IllegalStateException(
          "Calendar returned HTTP " +
            response.statusCode() +
            ". Check provider access and retry."
        );
      }
      db.update(
        "UPDATE calendar_jobs SET state='synced',attempts=?,last_error='',provider_id=?,updated_at=? WHERE id=?",
        attempts,
        providerId,
        now(),
        jobId
      );
    } catch (Exception e) {
      if (e instanceof InterruptedException) Thread.currentThread().interrupt();
      String message =
        e instanceof IllegalStateException
          ? e.getMessage()
          : "Calendar could not be reached. The booking is saved; retry later.";
      db.update(
        "UPDATE calendar_jobs SET state='failed',attempts=?,last_error=?,updated_at=? WHERE id=?",
        attempts,
        message,
        now(),
        jobId
      );
    }
  }
}
