-- Data migration: single-role jobs record their role on every application.
-- 1) Link each job that has no roles to the role with the same name (e.g. job "Bartender" -> role "Bartender").
INSERT INTO "job_positions" ("job_id", "position_id", "sort_order")
SELECT j."id", p."id", 0
FROM "jobs" j
JOIN "positions" p ON lower(p."name") = lower(j."title")
WHERE NOT EXISTS (SELECT 1 FROM "job_positions" jp WHERE jp."job_id" = j."id")
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- 2) Fill in the role on existing applications whose job has exactly one role.
UPDATE "applications" a
SET "position_id" = single."position_id"
FROM (
  SELECT "job_id", min("position_id"::text)::uuid AS "position_id"
  FROM "job_positions"
  GROUP BY "job_id"
  HAVING count(*) = 1
) single
WHERE a."job_id" = single."job_id" AND a."position_id" IS NULL;
