package dev.campusflow.ops;

import static dev.campusflow.ops.WorkflowService.require;
import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;

import java.util.*;
import org.springframework.stereotype.Component;

/** Bounded, process-local limits; a shared limiter is needed for multiple replicas. */
@Component
public class AuthThrottle {

  private record Bucket(long until, int count) {}

  private final Map<String, Bucket> buckets = new HashMap<>();

  public synchronized void check(String address, String email) {
    long now = System.currentTimeMillis();
    buckets.entrySet().removeIf(e -> e.getValue().until() < now);
    require(
      buckets.size() < 10000,
      TOO_MANY_REQUESTS,
      "Sign-in is busy. Try again later."
    );
    increment("ip:" + address, 60, now);
    increment("email:" + SessionService.hash(email), 12, now);
  }

  private void increment(String key, int limit, long now) {
    Bucket old = buckets.getOrDefault(key, new Bucket(now + 900_000, 0));
    require(
      old.count() < limit,
      TOO_MANY_REQUESTS,
      "Too many attempts. Try again in 15 minutes."
    );
    buckets.put(key, new Bucket(old.until(), old.count() + 1));
  }
}
