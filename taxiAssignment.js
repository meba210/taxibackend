import express from "express";
import { db } from "./server.js";

const router = express.Router();

router.get("/", (req, res) => {
    const sql = `
        SELECT 
            r.id,
            CONCAT(r.StartTerminal, ' → ', r.EndTerminal) AS Routes,
            (
                SELECT COUNT(*) 
                FROM taxis t 
                WHERE t.route_id = r.id
            ) AS Taxis
        FROM routes r;
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ DB Error:", err);
            return res.status(500).json({ message: "Database error" });
        }
        res.json(results);
    });
});

export default router;
