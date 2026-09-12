package dev.campusflow.ops;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
public class OutboxWorker {

  final CalendarDispatcher dispatcher;
  final JdbcTemplate db;
  final ActivityWindow activity;

  public OutboxWorker(
    CalendarDispatcher dispatcher,
    JdbcTemplate db,
    ActivityWindow activity
  ) {
    this.dispatcher = dispatcher;
    this.db = db;
    this.activity = activity;
  }

  @Scheduled(
    fixedDelayString = "${ops.dispatch-delay}",
    initialDelayString = "${ops.dispatch-delay}"
  )
  public void poll() {
    if (!activity.active()) return;
    var ids = db.queryForList(
      "SELECT id FROM calendar_jobs WHERE state IN ('pending','failed') AND attempts < 3 ORDER BY updated_at LIMIT 10",
      String.class
    );
    for (String id : ids) dispatcher.dispatch(id);
  }
}
