package dev.campusflow.ops;

import jakarta.servlet.http.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ops/auth")
public class AuthController {

  private final AuthService auth;
  private final SessionService sessions;
  private final AuthThrottle throttle;
  private final boolean secure;

  public AuthController(
    AuthService auth,
    SessionService sessions,
    AuthThrottle throttle,
    @Value("${ops.cookie-secure}") boolean secure
  ) {
    this.auth = auth;
    this.sessions = sessions;
    this.throttle = throttle;
    this.secure = secure;
  }

  static String cookie(HttpServletRequest req) {
    if (req.getCookies() != null) for (Cookie c : req.getCookies())
      if (c.getName().equals("cf_ops")) return c.getValue();
    return null;
  }

  private Map<String, Object> signedIn(
    Map<String, Object> result,
    HttpServletRequest req,
    HttpServletResponse res
  ) {
    sessions.end(cookie(req));
    var data = new HashMap<>(result);
    res.addHeader(
      "Set-Cookie",
      ResponseCookie.from("cf_ops", data.remove("token").toString())
        .httpOnly(true)
        .secure(secure)
        .sameSite("Lax")
        .path("/api/ops")
        .maxAge(86400)
        .build()
        .toString()
    );
    return data;
  }

  @PostMapping("/register")
  public Map<String, Object> register(
    @RequestBody Map<String, String> body,
    HttpServletRequest req,
    HttpServletResponse res
  ) {
    throttle.check(
      req.getRemoteAddr(),
      Objects.toString(body.get("email"), "").trim().toLowerCase(Locale.ROOT)
    );
    return signedIn(
      auth.register(
        body.get("email"),
        body.get("name"),
        body.get("password"),
        body.get("invitation")
      ),
      req,
      res
    );
  }

  @PostMapping("/login")
  public Map<String, Object> login(
    @RequestBody Map<String, String> body,
    HttpServletRequest req,
    HttpServletResponse res
  ) {
    throttle.check(
      req.getRemoteAddr(),
      Objects.toString(body.get("email"), "").trim().toLowerCase(Locale.ROOT)
    );
    return signedIn(
      auth.login(body.get("email"), body.get("password")),
      req,
      res
    );
  }

  @PostMapping("/logout")
  public Map<String, Object> logout(
    HttpServletRequest req,
    HttpServletResponse res
  ) {
    sessions.end(cookie(req));
    res.addHeader(
      "Set-Cookie",
      ResponseCookie.from("cf_ops", "")
        .httpOnly(true)
        .secure(secure)
        .sameSite("Lax")
        .path("/api/ops")
        .maxAge(0)
        .build()
        .toString()
    );
    return Map.of("ok", true);
  }

  @SuppressWarnings("unchecked")
  @PostMapping("/invite")
  public Map<String, Object> invite(
    @RequestBody Map<String, String> body,
    HttpServletRequest req
  ) {
    return auth.invite(
      (Map<String, Object>) req.getAttribute("opsSession"),
      body.get("email"),
      body.get("role")
    );
  }

  @SuppressWarnings("unchecked")
  @PostMapping("/password")
  public Map<String, Object> password(
    @RequestBody Map<String, String> body,
    HttpServletRequest req,
    HttpServletResponse res
  ) {
    throttle.check(
      req.getRemoteAddr(),
      "password-change:" + ((Map<String, Object>) req.getAttribute("opsSession")).get("account_id")
    );
    return signedIn(
      auth.changePassword(
        (Map<String, Object>) req.getAttribute("opsSession"),
        body.get("currentPassword"),
        body.get("password")
      ),
      req,
      res
    );
  }
}
