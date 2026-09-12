package dev.campusflow.ops;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.server.ResponseStatusException;

@Configuration
public class SecurityConfig {

  @Bean
  SecurityFilterChain chain(
    HttpSecurity http,
    SessionService sessions,
    ActivityWindow activity,
    ObjectMapper json,
    @Value("${ops.allowed-origin}") String origin
  ) throws Exception {
    // Synchronizer CSRF tokens are checked below against the server-side session.
    http
      .csrf(c -> c.disable())
      .formLogin(c -> c.disable())
      .httpBasic(c -> c.disable())
      .sessionManagement(c ->
        c.sessionCreationPolicy(
          org.springframework.security.config.http.SessionCreationPolicy.STATELESS
        )
      )
      .authorizeHttpRequests(c -> c.anyRequest().permitAll())
      .headers(c -> c.contentTypeOptions(o -> {}).frameOptions(f -> f.deny()))
      .addFilterBefore(
        new OncePerRequestFilter() {
          protected void doFilterInternal(
            HttpServletRequest req,
            HttpServletResponse res,
            FilterChain chain
          ) throws ServletException, IOException {
            String path = req.getRequestURI();
            if (!path.startsWith("/api/ops")) {
              chain.doFilter(req, res);
              return;
            }
            try {
              activity.touch();
              res.setHeader("Cache-Control", "no-store");
              boolean write = !List.of("GET", "HEAD", "OPTIONS").contains(
                req.getMethod()
              );
              String requestOrigin = req.getHeader("Origin");
              if (
                write &&
                requestOrigin != null &&
                !Arrays.asList(origin.split(",")).contains(requestOrigin)
              ) throw new ResponseStatusException(
                org.springframework.http.HttpStatus.FORBIDDEN,
                "This origin is not allowed."
              );
              boolean bootstrap =
                List.of(
                  "/api/ops/session",
                  "/api/ops/auth/login",
                  "/api/ops/auth/register"
                ).contains(path) &&
                req.getMethod().equals("POST");
              if (bootstrap) {
                if (
                  !"1".equals(req.getHeader("X-CampusFlow"))
                ) throw new ResponseStatusException(
                  org.springframework.http.HttpStatus.FORBIDDEN,
                  "A same-origin session request is required."
                );
              } else {
                String token = null;
                if (req.getCookies() != null) for (Cookie c : req.getCookies())
                  if (c.getName().equals("cf_ops")) token = c.getValue();
                var session = sessions.lookup(token);
                if (write) {
                  String provided = req.getHeader("X-CSRF-Token");
                  if (
                    provided == null ||
                    !MessageDigest.isEqual(
                      provided.getBytes(StandardCharsets.UTF_8),
                      session
                        .get("csrf")
                        .toString()
                        .getBytes(StandardCharsets.UTF_8)
                    )
                  ) throw new ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN,
                    "Refresh the page before trying again."
                  );
                }
                req.setAttribute("opsSession", session);
              }
              res.setHeader("Cache-Control", "no-store");
              chain.doFilter(req, res);
            } catch (ResponseStatusException ex) {
              res.setStatus(ex.getStatusCode().value());
              res.setContentType("application/json");
              json.writeValue(
                res.getWriter(),
                Map.of("message", ex.getReason())
              );
            }
          }
        },
        UsernamePasswordAuthenticationFilter.class
      );
    return http.build();
  }
}
