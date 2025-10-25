ALTER TABLE "User" ADD COLUMN "messagesSentCount" integer DEFAULT 0 NOT NULL;

UPDATE "User" u
SET "messagesSentCount" = COALESCE(sub."count", 0)
FROM (
	SELECT c."userId", COUNT(m."id") AS "count"
	FROM "Chat" c
	JOIN "Message_v2" m ON m."chatId" = c."id"
	WHERE m."role" = 'user'
	GROUP BY c."userId"
) AS sub
WHERE u."id" = sub."userId";
