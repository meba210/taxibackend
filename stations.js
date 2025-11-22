
import express from "express";
import {db } from "./server.js"; 
const router = express.Router();

router.post("/", (req, res) => {
  const { StationName, City, location } = req.body;

  if (!StationName || !City || !location) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const sql = "INSERT INTO stations (StationName,City,location ) VALUES (?, ?, ?)";
  db.query(sql, [StationName, City,location], (err, result) => {
    if (err) {
      console.error("❌ Error inserting station:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json({ message: "✅ Station created successfully" });
  });
});


router.get("/", (req, res) => {
  db.query("SELECT * FROM stations", (err, results) => {
    if (err) {
      console.error("❌ Error fetching stations:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json(results);
  });
});

router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { name, city, location } = req.body;

  const sql = "UPDATE stations SET StationName = ?, City = ?, location = ? WHERE id = ?";
  db.query(sql, [name, city, location, id], (err, result) => {
    if (err) {
      console.error("❌ Error updating station:", err);
      return res.status(500).json({ message: "Database error", error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Station not found" });

    res.json({ message: "✅ Station updated successfully" });
  });
});


// ✅ Delete a station
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE  FROM stations WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("❌ Error deleting station:", err);
      return res.status(500).json({ message: "Database error", error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Station not found" });

    res.json({ message: "✅ Station deleted successfully" });
  });
});

export default router;








