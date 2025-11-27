
import express from "express";
import { query } from "./index.js"; // your db promisified query
import jwt from "jsonwebtoken";

const router = express.Router();

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = decoded;
    next();
  });
}

router.get("/", verifyToken, async (req, res) => {
  try {
    const rows = await query(
      `
      SELECT 
          r.id,
          CONCAT(r.StartTerminal, ' → ', r.EndTerminal) AS Routes,

          -- Count taxis for this route
          (
              SELECT COUNT(*)
              FROM taxi_queue t
              WHERE t.route = CONCAT(r.StartTerminal, ' → ', r.EndTerminal)
          ) AS Taxis,

          -- Get passenger waiting count
          (
              SELECT p.WaitingCount
              FROM passengerqueue p
              WHERE p.route = CONCAT(r.StartTerminal, ' → ', r.EndTerminal)
              LIMIT 1
          ) AS WaitingCount

      FROM routes r
      WHERE r.StationAdmins_id = ?;
      `,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Fetching error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});


export default router;
