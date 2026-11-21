BEGIN;

--
-- ACTION CREATE TABLE
--
CREATE TABLE "attendance_record" (
    "id" bigserial PRIMARY KEY,
    "sessionId" bigint NOT NULL,
    "memberName" text NOT NULL,
    "checkedInAt" timestamp without time zone NOT NULL
);

-- Indexes
CREATE UNIQUE INDEX "attendance_session_member_idx" ON "attendance_record" USING btree ("sessionId", "memberName");

--
-- ACTION CREATE TABLE
--
CREATE TABLE "attendance_session" (
    "id" bigserial PRIMARY KEY,
    "groupId" bigint NOT NULL,
    "sessionCode" text NOT NULL,
    "title" text NOT NULL,
    "isActive" boolean NOT NULL,
    "createdAt" timestamp without time zone NOT NULL,
    "closedAt" timestamp without time zone
);


--
-- MIGRATION VERSION FOR groundlink_app
--
INSERT INTO "serverpod_migrations" ("module", "version", "timestamp")
    VALUES ('groundlink_app', '20261121195653604', now())
    ON CONFLICT ("module")
    DO UPDATE SET "version" = '20261121195653604', "timestamp" = now();

--
-- MIGRATION VERSION FOR serverpod
--
INSERT INTO "serverpod_migrations" ("module", "version", "timestamp")
    VALUES ('serverpod', '20260824182259319', now())
    ON CONFLICT ("module")
    DO UPDATE SET "version" = '20260824182259319', "timestamp" = now();

--
-- MIGRATION VERSION FOR serverpod_auth_idp
--
INSERT INTO "serverpod_migrations" ("module", "version", "timestamp")
    VALUES ('serverpod_auth_idp', '20261015164015382', now())
    ON CONFLICT ("module")
    DO UPDATE SET "version" = '20261015164015382', "timestamp" = now();

--
-- MIGRATION VERSION FOR serverpod_auth_core
--
INSERT INTO "serverpod_migrations" ("module", "version", "timestamp")
    VALUES ('serverpod_auth_core', '20260924105232991', now())
    ON CONFLICT ("module")
    DO UPDATE SET "version" = '20260924105232991', "timestamp" = now();


COMMIT;
