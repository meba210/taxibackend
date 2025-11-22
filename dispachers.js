
import express from "express";
import {db } from "./server.js"; 
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

router.post("/",verifyToken, async (req, res) => {
  const { FullName,Email, PhoneNumber,UserName,Routes,role_id} = req.body;

  if (req.user.role !== "stationAdmin") return res.status(403).json({ message: "Forbidden" });

   try {
    const result = await query(
      "INSERT INTO dispachers (FullName, Email, PhoneNumber,UserName,Routes,role_id,StationAdmins_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [ FullName,Email, PhoneNumber,UserName,Routes,role_id,req.user.id]
    );
    res.json({ message: "Dispacher created", id: result.insertId });
  } catch (err) {
    console.error("Create dispacher error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});



router.get("/", verifyToken, async (req, res) => {
  if (req.user.role !== "stationAdmin") return res.status(403).json({ message: "Forbidden" });

  try {
    const rows = await query(
      "SELECT * FROM dispachers WHERE StationAdmins_id = ?",
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Fetch dispachers error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});


router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { FullName, Email, PhoneNumber,UserName,Routes} = req.body;

  const sql = "UPDATE dispachers SET FullName = ?, Email= ?, PhoneNumber = ? ,UserName= ?,Routes=?  WHERE id = ?";
  db.query(sql, [FullName, Email, PhoneNumber,UserName,Routes,id], (err, result) => {
    if (err) {
      console.error("❌ Error updating dispachers:", err);
      return res.status(500).json({ message: "Database error", error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "dispachers not found" });

    res.json({ message: "✅ dispacher updated successfully" });
  });
});


router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE  FROM dispachers WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("❌ Error deleting :", err);
      return res.status(500).json({ message: "Database error", error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "dispachers not found" });

    res.json({ message: "✅ dispachers deleted successfully" });
  });
});


export default router;