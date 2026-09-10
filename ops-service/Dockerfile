FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn -q package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN groupadd -r campusflow && useradd -r -g campusflow campusflow && mkdir .runtime && chown campusflow:campusflow .runtime
COPY --from=build /app/target/ops-service-1.0.0.jar app.jar
USER campusflow
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["java","-XX:MaxRAMPercentage=70.0","-jar","app.jar"]
