import { Router } from 'express';
import { db } from '../db/db.js';
import { eq, desc } from 'drizzle-orm';
import { commentary } from '../db/schema.js';
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

    const limit = Math.min(queryResult.data.limit ?? 100, MAX_LIMIT);

    try {
        const { id: matchId } = paramsResult.data;
        const { limit = 10 } = paramsResult.data;

        const safeLimit = Math.min(limit, MAX_LIMIT);

        const results = await db.select()
            .from(commentary)
            .where(eq(commentary.matchId, paramsResult.data.id))
            .orderBy(desc(commentary.createdAt))
            .limit(limit);

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
        const { minutes, ...rest } = bodyResult.data;
        const [result] = await db.insert(commentary).values({
            matchId: paramsResult.data.id,
            minutes,
            ...rest,
        }).returning();

        res.status(201).json({ data: result })
    } catch (error) {
        console.error('Error creating commentary:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});