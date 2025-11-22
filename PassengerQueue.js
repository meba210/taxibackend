
import express from "express";
import {db } from "./server.js"; 
const router = express.Router();

router.post("/", (req, res) => {
  const { WaitingCount,route_id,Station_id, Status} = req.body;

  if (! WaitingCount ) {
    return res.status(400).json({ message: "Add the number of the passengers" });
  }

  const sql = "INSERT INTO Passengerqueue (WaitingCount,route_id,Station_id,Status) VALUES (?, ?, ?, ?)";
  db.query(sql, [WaitingCount,route_id,Station_id,Status ], (err, result) => {
    if (err) {
      console.error("❌ Error inserting passengers:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json({ message: "✅ Added successfully" });
  });
});


router.get("/", (req, res) => {
  db.query("SELECT * FROM  Passengerqueue", (err, results) => {
    if (err) {
      console.error("❌ Error fetching data:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json(results);
  });
});

router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { WaitingCount, Status} = req.body;

  const sql = "UPDATE  Passengerqueue SET WaitingCount = ?,Status = ? WHERE id = ?";
  db.query(sql, [WaitingCount,Status,id], (err, result) => {
    if (err) {
      console.error("❌ Error updating Passenger:", err);
      return res.status(500).json({ message: "Database error", error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "data not found" });

    res.json({ message: "✅ Taxi updated successfully" });
  });
});


// ✅ Delete a station
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE  FROM  Passengerqueue WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("❌ Error deleting Passenger:", err);
      return res.status(500).json({ message: "Database error", error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "data not found" });

    res.json({ message: "✅ data deleted successfully" });
  });
});

export default router;








