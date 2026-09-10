package dev.campusflow.ops;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
@Component
@EnableScheduling
public class OutboxWorker {
    final CalendarDispatcher dispatcher; final JdbcTemplate db;
    public OutboxWorker(CalendarDispatcher dispatcher,JdbcTemplate db){this.dispatcher=dispatcher;this.db=db;}
    @Scheduled(fixedDelayString="${ops.dispatch-delay}",initialDelayString="${ops.dispatch-delay}")
    public void poll(){
        var ids=db.queryForList("SELECT id FROM calendar_jobs WHERE state IN ('pending','failed') AND attempts < 3 ORDER BY updated_at LIMIT 10",String.class);
        for(String id:ids)dispatcher.dispatch(id);
    }
}
