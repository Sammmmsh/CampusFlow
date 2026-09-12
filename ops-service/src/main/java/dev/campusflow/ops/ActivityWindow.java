package dev.campusflow.ops;

import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Component;

/** Lets the free database sleep after interactive traffic stops. */
@Component
public class ActivityWindow {

  private final AtomicLong lastRequest = new AtomicLong(
    System.currentTimeMillis()
  );

  public void touch() {
    lastRequest.set(System.currentTimeMillis());
  }

  public boolean active() {
    return System.currentTimeMillis() - lastRequest.get() < 180_000;
  }
}
