
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

router.post("/", (req, res) => {
  const { FullName,Email, PhoneNumber,UserName,selectedStation,role_id} = req.body;

  if (!FullName || !Email || !PhoneNumber||!UserName||!selectedStation) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const sql = "INSERT INTO stationadmins (FullName,Email,PhoneNumber,UserName,Stations,role_id) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(sql, [FullName, Email ,PhoneNumber,UserName,selectedStation,role_id], (err, result) => {
    if (err) {
      console.error("❌ Error inserting station Admin:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json({ message: "✅ Admin created successfully" });
  });
});

router.get("/",(req, res) => {
  try {
    const sql = "SELECT * FROM stationadmins";

    db.query(sql, (err, results) => {
      if (err) {
        console.error("Fetching error:", err);
        return res.status(500).json({ 
          message: err.sqlMessage || err.message 
        });
      }

      res.status(200).json(results);
    });

  } catch (err) {
    console.error("Fetching error:", err);
    res.status(500).json({ 
      message: err.sqlMessage || err.message 
    });
  }
});


router.get("/stationadmin-stations", verifyToken, async (req, res) => {
  if (req.user.role !== "stationAdmin") return res.status(403).json({ message: "Forbidden" });

  try {
    const rows = await query(
      "SELECT Stations,FullName FROM stationadmins WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0) return res.status(404).json({ message: "No route assigned" });

   res.json({
  station: rows[0].Stations,
  name: rows[0].FullName
});
   
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});


router.get("/total", (req, res) => {
  const sql = "SELECT COUNT(*) AS total FROM stationadmins";
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching total stationadmins:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json(results[0]);
  });
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const sql = "SELECT * FROM stationadmins WHERE id = ?"; // Fixed query

    db.query(sql, [id], (err, results) => {
      if (err) {
        console.error("Fetching error:", err);
        return res.status(500).json({ 
          message: err.sqlMessage || err.message 
        });
      }

      if (results.length === 0) {
        return res.status(404).json({ 
          message: "Station admin not found" 
        });
      }

      res.status(200).json(results[0]);
    });

  } catch (err) {
    console.error("Fetching error:", err);
    res.status(500).json({ 
      message: err.sqlMessage || err.message 
    });
  }
});


router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { FullName, Email, PhoneNumber, UserName, Stations} = req.body;

  const sql = `
    UPDATE stationadmins 
    SET FullName=?, Email=?, PhoneNumber=?, UserName=?, Stations=? 
    WHERE id=?
  `;
  db.query(sql, [FullName, Email, PhoneNumber, UserName,  Stations, id], (err, result) => {
    if (err) {
      console.error("❌ Error updating station admin:", err);
      return res.status(500).json({ message: "Database error", error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Station Admin not found" });

    res.json({ message: "✅ Station Admin updated successfully" });
  });
});


router.put('/:id/changePassword', verifyToken, (req, res) => {
  if (req.user.role !== 'stationAdmin') 
    return res.status(403).json({ message: 'Forbidden' });

  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  // Get current password
  const getSql = 'SELECT Password FROM stationadmins WHERE id = ?';
  db.query(getSql, [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error' });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

    const storedPassword = results[0].Password;

    // Check current password
    if (currentPassword !== storedPassword) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Update password and reset mustChangePassword flag
    const updateSql = 'UPDATE stationadmins SET Password = ?, mustChangePassword = 0 WHERE id = ?';
    db.query(updateSql, [newPassword, id], (updateErr, result) => {
      if (updateErr) return res.status(500).json({ success: false, message: 'Failed to update password' });

      res.json({ success: true, message: '✅ Password updated successfully' });
    });
  });
});


// ✅ Delete a station
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE  FROM stationadmins WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("❌ Error deleting station:", err);
      return res.status(500).json({ message: "Database error", error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: " Station Admin not found" });

    res.json({ message: "✅ Station Admin deleted successfully" });
  });
});


export default router;