
import express from "express";
import {db } from "./server.js"; 
import jwt from "jsonwebtoken";
import { query } from "./index.js";
const router = express.Router();



router.get("/total", async (req, res) => {
  try {
    const rows = await query(`
      SELECT count(*) AS total
      FROM dispachers
    `);

    res.json(rows[0]); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

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

router.get("/:id", verifyToken, async (req, res) => {
  if (req.user.role !== "stationAdmin") return res.status(403).json({ message: "Forbidden" });
   const { id } = req.params;
  try {
    const rows = await query(
      "SELECT * FROM dispachers WHERE id=? AND StationAdmins_id = ?",
       [ id, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Fetch dispachers error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});



router.get("/eachstation", verifyToken, async (req, res) => {
  if (req.user.role !== "stationAdmin") return res.status(403).json({ message: "Forbidden" });

  try {
    const rows = await query(
      " SELECT count(*) AS total FROM dispachers WHERE StationAdmins_id = ?",
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



router.put('/:id/changePassword', verifyToken, (req, res) => {
  if (req.user.role !== 'dispacher') 
    return res.status(403).json({ message: 'Forbidden' });

  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  // Get current password
  const getSql = 'SELECT Password FROM dispachers WHERE id = ?';
  db.query(getSql, [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error' });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

    const storedPassword = results[0].Password;

    // Check current password
    if (currentPassword !== storedPassword) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Update password and reset mustChangePassword flag
    const updateSql = 'UPDATE dispachers SET Password = ?, mustChangePassword = 0 WHERE id = ?';
    db.query(updateSql, [newPassword, id], (updateErr, result) => {
      if (updateErr) return res.status(500).json({ success: false, message: 'Failed to update password' });

      res.json({ success: true, message: '✅ Password updated successfully' });
    });
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