package com.kaldinote.crawler.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CrawlRunMigrationTest extends AbstractIntegrationTest {

  private static final String SCHEMA = "crawl_run_migration_test";

  @Autowired private DataSource dataSource;

  @Test
  @DisplayName("AC-CRAWLRESULT-30 · 마이그레이션이 기존 행을 기본값으로 채운다")
  void 마이그레이션이_기존_행을_기본값으로_채운다() throws Exception {
    Instant startedAt = Instant.parse("2026-10-19T12:25:58.963255Z");
    Instant finishedAt = Instant.parse("2026-10-19T12:26:36.167353Z");

    try (Connection conn = dataSource.getConnection();
        Statement st = conn.createStatement()) {
      st.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
      st.execute("CREATE SCHEMA " + SCHEMA);
    }

    try {
      Flyway.configure()
          .dataSource(dataSource)
          .schemas(SCHEMA)
          .locations("classpath:db/migration")
          .target("20")
          .load()
          .migrate();

      try (Connection conn = dataSource.getConnection();
          PreparedStatement ps =
              conn.prepareStatement(
                  "INSERT INTO "
                      + SCHEMA
                      + ".crawl_runs"
                      + " (source, status, started_at, finished_at, created_count, updated_count,"
                      + " skipped, unmapped)"
                      + " VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb)")) {
        ps.setString(1, "momos");
        ps.setString(2, "SUCCEEDED");
        ps.setTimestamp(3, Timestamp.from(startedAt));
        ps.setTimestamp(4, Timestamp.from(finishedAt));
        ps.setInt(5, 21);
        ps.setInt(6, 0);
        ps.setString(7, "[{\"name\":\"원두 A\",\"reason\":\"USER_OWNED\"}]");
        ps.setString(8, "[]");
        ps.executeUpdate();
      }

      Flyway.configure()
          .dataSource(dataSource)
          .schemas(SCHEMA)
          .locations("classpath:db/migration")
          .target("21")
          .load()
          .migrate();

      try (Connection conn = dataSource.getConnection();
          Statement st = conn.createStatement();
          ResultSet rs =
              st.executeQuery(
                  "SELECT source, status, started_at, finished_at, created_count, updated_count,"
                      + " skipped = '[{\"name\":\"원두 A\",\"reason\":\"USER_OWNED\"}]'::jsonb"
                      + " AS skipped_same,"
                      + " unmapped = '[]'::jsonb AS unmapped_same,"
                      + " imported = '[]'::jsonb AS imported_empty,"
                      + " unchanged_count"
                      + " FROM "
                      + SCHEMA
                      + ".crawl_runs")) {
        assertThat(rs.next()).isTrue();
        assertThat(rs.getString("source")).isEqualTo("momos");
        assertThat(rs.getString("status")).isEqualTo("SUCCEEDED");
        assertThat(rs.getTimestamp("started_at").toInstant()).isEqualTo(startedAt);
        assertThat(rs.getTimestamp("finished_at").toInstant()).isEqualTo(finishedAt);
        assertThat(rs.getInt("created_count")).isEqualTo(21);
        assertThat(rs.getInt("updated_count")).isZero();
        assertThat(rs.getBoolean("skipped_same")).isTrue();
        assertThat(rs.getBoolean("unmapped_same")).isTrue();
        assertThat(rs.getBoolean("imported_empty")).isTrue();
        assertThat(rs.getInt("unchanged_count")).isZero();
      }
    } finally {
      try (Connection conn = dataSource.getConnection();
          Statement st = conn.createStatement()) {
        st.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
      }
    }
  }
}
