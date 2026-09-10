package dev.campusflow.ops;

import java.security.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static dev.campusflow.ops.WorkflowService.*;
import static org.springframework.http.HttpStatus.*;

@Service
public class SessionService {
    final JdbcTemplate db; final WorkflowService workflow;
    public SessionService(JdbcTemplate db,WorkflowService workflow) {this.db=db;this.workflow=workflow;}
    static String token() { byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);return HexFormat.of().formatHex(bytes); }
    static String hash(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch(Exception e){throw new IllegalStateException(e);} }
    @Transactional
    public Map<String,Object> start(String role) {
        require(List.of("student","faculty","inventory").contains(role),BAD_REQUEST,"Choose a valid demo role.");
        db.update("DELETE FROM workspaces WHERE created_at < ?",time(Instant.now().minusSeconds(7*86400)));
        require(db.queryForObject("SELECT COUNT(*) FROM workspaces",Integer.class)<2000,TOO_MANY_REQUESTS,"The demo is busy. Please try again later.");
        String ws=workflow.seed(),token=token(),csrf=token();
        db.update("INSERT INTO sessions VALUES (?,?,?,?,?)",hash(token),ws,role,csrf,time(Instant.now().plusSeconds(86400)));
        return Map.of("token",token,"csrf",csrf,"workspace",ws,"role",role,"name",actor(role),"demo",true);
    }
    public Map<String,Object> lookup(String token) {
        require(token!=null && token.matches("[a-f0-9]{64}"),UNAUTHORIZED,"Start a demo workspace to continue.");
        var sessions=db.queryForList("SELECT * FROM sessions WHERE id=? AND expires_at > ?",hash(token),now());
        require(!sessions.isEmpty(),UNAUTHORIZED,"Your demo session expired. Start a new workspace.");
        return sessions.get(0);
    }
    public void role(Map<String,Object> session,String role) {
        require(List.of("student","faculty","inventory").contains(role),BAD_REQUEST,"Choose a valid demo role.");
        db.update("UPDATE sessions SET role=? WHERE id=?",role,session.get("id"));
    }
}
