// GET dispatcher assigned route
import express from "express";
import { db } from "./server.js";
import jwt from "jsonwebtoken";
import { query } from "./index.js";

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
  if (req.user.role !== "dispacher") return res.status(403).json({ message: "Forbidden" });

  try {
    const rows = await query(
      "SELECT Routes FROM dispachers WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0) return res.status(404).json({ message: "No route assigned" });

   res.json({ route: rows[0].Routes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

export default router;
