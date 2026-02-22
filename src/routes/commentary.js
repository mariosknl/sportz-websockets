import { Router } from 'express';
import { db } from '../db/db.js';
import { eq, desc } from 'drizzle-orm';
import { commentary, matches } from '../db/schema.js';
import { createCommentarySchema, listCommentaryQuerySchema } from '../validation/commentary.js';
import { matchIdParamSchema } from '../validation/matches.js';

export const commentaryRouter = Router({ mergeParams: true });

const MAX_LIMIT = 100;

commentaryRouter.get("/", async (req, res) => {
    const paramsResult = matchIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({ error: 'Invalid match ID', details: paramsResult.error.issues });
    }

    const queryResult = listCommentaryQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
        return res.status(400).json({ error: 'Invalid query parameters', details: queryResult.error.issues });
    }

    const safeLimit = Math.min(queryResult.data.limit ?? 10, MAX_LIMIT);

    try {
        const { id: matchId } = paramsResult.data;

        // Verify match existence for GET too, as per best practice when match ID is in URL
        const [match] = await db.select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .limit(1);

        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }

        const results = await db.select()
            .from(commentary)
            .where(eq(commentary.matchId, matchId))
            .orderBy(desc(commentary.createdAt))
            .limit(safeLimit);

        res.status(200).json({ data: results });
    } catch (error) {
        console.error('Error fetching commentary:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

commentaryRouter.post("/", async (req, res) => {
    const paramsResult = matchIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({ error: 'Invalid match ID', details: paramsResult.error.issues });
    }

    const bodyResult = createCommentarySchema.safeParse(req.body);
    if (!bodyResult.success) {
        return res.status(400).json({ error: 'Invalid commentary payload.', details: bodyResult.error.issues })
    }

    try {
        const { id: matchId } = paramsResult.data;

        // Verify match exists prior to inserting commentary
        const [match] = await db.select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .limit(1);

        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }

        const { minutes, ...rest } = bodyResult.data;
        const [entry] = await db.insert(commentary).values({
            matchId: matchId,
            minutes,
            ...rest,
        }).returning();

        if(res.app.locals.broadcastCommentary) {
            res.app.locals.broadcastCommentary(entry.matchId, entry);
        }

        res.status(201).json({ data: entry })
    } catch (error) {
        console.error('Error creating commentary:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});