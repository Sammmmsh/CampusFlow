package dev.campusflow.ops;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "spring.datasource.url=${TEST_DATABASE_URL:jdbc:h2:mem:smoke;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1}")
class CampusFlowOpsApplicationTests {

  @Test
  void contextLoads() {}
}

