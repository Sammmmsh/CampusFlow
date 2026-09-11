package dev.campusflow.ops;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(
  exclude = org.springframework.boot.autoconfigure.security.servlet
    .UserDetailsServiceAutoConfiguration.class
)
public class CampusFlowOpsApplication {

  public static void main(String[] args) {
    SpringApplication.run(CampusFlowOpsApplication.class, args);
  }
}
