import express from "express";
import { query } from "./index.js"; // promisified query
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

router.post("/", verifyToken, async (req, res) => {
  const { StartTerminal, EndTerminal } = req.body;
  if (req.user.role !== "stationAdmin") return res.status(403).json({ message: "Forbidden" });

  try {
    const result = await query(
      "INSERT INTO routes (StationAdmins_id, StartTerminal, EndTerminal) VALUES (?, ?, ?)",
      [req.user.id, StartTerminal, EndTerminal]
    );
    res.json({ message: "Route created", id: result.insertId });
  } catch (err) {
    console.error("Create route error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get("/", verifyToken, async (req, res) => {
  if (req.user.role !== "stationAdmin") return res.status(403).json({ message: "Forbidden" });

  try {
    const rows = await query(
      "SELECT id, StartTerminal, EndTerminal FROM routes WHERE StationAdmins_id = ?",
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Fetch routes error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { StartTerminal, EndTerminal } = req.body;

  if (req.user.role !== "stationAdmin") return res.status(403).json({ message: "Forbidden" });

  try {
    const result = await query(
      "UPDATE routes SET StartTerminal=?, EndTerminal=? WHERE id=? AND StationAdmins_id=?",
      [StartTerminal, EndTerminal, id, req.user.id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Route not found or unauthorized" });

    res.json({ message: "Route updated" });
  } catch (err) {
    console.error("Update route error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});


router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== "stationAdmin") return res.status(403).json({ message: "Forbidden" });

  try {
    const result = await query(
      "DELETE FROM routes WHERE id=? AND StationAdmins_id=?",
      [id, req.user.id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Route not found or unauthorized" });

    res.json({ message: "Route deleted" });
  } catch (err) {
    console.error("Delete route error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

export default router;







