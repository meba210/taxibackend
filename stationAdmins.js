
import express from "express";
import {db } from "./server.js"; 
const router = express.Router();

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

router.get("/", (req, res) => {
  const sql = `
    SELECT sa.id, sa.FullName, sa.Email, sa.PhoneNumber, sa.UserName, 
           sa.Stations AS StationID,
           s.StationName
    FROM stationadmins sa
    LEFT JOIN stations s ON sa.Stations = s.id
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching station admins:", err);
      return res.status(500).json({ message: "Database error" });
    }

    // Map results to display the station name for the table
    const formatted = results.map((r) => ({
      ...r,
      Stations: r.StationName,  // <-- this will show in your table
    }));

    res.status(200).json(formatted);
  });
});

router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { FullName, Email, PhoneNumber, UserName,selectedStation } = req.body;

  const sql = `
    UPDATE stationadmins 
    SET FullName=?, Email=?, PhoneNumber=?, UserName=?, Stations=? 
    WHERE id=?
  `;
  db.query(sql, [FullName, Email, PhoneNumber, UserName, selectedStation, id], (err, result) => {
    if (err) {
      console.error("❌ Error updating station admin:", err);
      return res.status(500).json({ message: "Database error", error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Station Admin not found" });

    res.json({ message: "✅ Station Admin updated successfully" });
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