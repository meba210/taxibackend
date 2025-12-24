
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

router.get("/total", (req, res) => {
  const sql = "SELECT COUNT(*) AS total FROM stations";
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching total stations:", err);
      return res.status(500).json({ message: "Database error" });
    }
    
    // results will be an array with one object like: [{ total: 15 }]
    res.status(200).json(results[0]);
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



router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const sql = "SELECT * FROM stations WHERE id = ?"; 

    db.query(sql, [id], (err, results) => {
      if (err) {
        console.error("Fetching error:", err);
        return res.status(500).json({ 
          message: err.sqlMessage || err.message 
        });
      }

      if (results.length === 0) {
        return res.status(404).json({ 
          message: "Station not found" 
        })
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

// Add this route to your stations.js backend file
router.put("/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ message: "Status must be 'active' or 'inactive'" });
  }

  const sql = "UPDATE stations SET status = ? WHERE id = ?";
  db.query(sql, [status, id], (err, result) => {
    if (err) {
      console.error("❌ Error updating station status:", err);
      return res.status(500).json({ message: "Database error", error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Station not found" });

    res.json({ 
      message: `✅ Station ${status} successfully`,
      status: status 
    });
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








