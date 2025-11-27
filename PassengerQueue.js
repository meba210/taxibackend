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


// router.post("/", verifyToken, async(req, res) => {
//    if (req.user.role !== "dispacher") return res.status(403).json({ message: "Forbidden" });
//   const { WaitingCount,dispacher_id, Status} = req.body;

//   if (! WaitingCount ) {
//     return res.status(400).json({ message: "Add the number of the passengers" });
//   }
// try {
//   const result = await query( "INSERT INTO Passengerqueue (WaitingCount,Status,dispacher_id) VALUES (?, ?, ?)",
//   [WaitingCount,Status,req.user.id], 
//   );
//    res.status(201).json({ message: "Added successfully", id: result.insertId });
//   } catch (err) {
//     console.error("Adding error:", err);
//     res.status(500).json({ message: err.sqlMessage || err.message });
//   }
// });


router.post("/", verifyToken, async (req, res) => {
  const { waiting_count,route } = req.body;
  if (!waiting_count) return res.status(400).json({ message: "Waiting count required" });

  try {
    // Check if record exists for this dispatcher
    const existing = await query(
      "SELECT * FROM passengerqueue WHERE dispacher_id = ?",
      [req.user.id]
    );

    if (existing.length > 0) {
      // Update
      await query(
        "UPDATE passengerqueue SET WaitingCount = ? WHERE dispacher_id = ?",
        [waiting_count, req.user.id]
      );
      return res.json({ message: "Passenger count updated" });
    }

    // Add new
    await query(
      "INSERT INTO passengerqueue (dispacher_id, WaitingCount,route) VALUES (?, ?, ?)",
      [req.user.id, waiting_count,route]
    );
    res.json({ message: "Passenger count added" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// router.get("/", verifyToken, async (req, res) => {

//   try {
//     const rows = await query("SELECT  WaitingCount FROM  Passengerqueue  WHERE route = CONCAT(r.StartTerminal, ' → ', r.EndTerminal)",
//        [req.user.id]
//     );
//     res.json(rows);

//   } catch (err) {
//     console.error("Fetching error:", err);
//     res.status(500).json({ message: err.sqlMessage || err.message });
//   }
// });


router.put("/:id",verifyToken, async (req, res) => {
  const { id } = req.params;
  const { WaitingCount, Status} = req.body;

  try {
    const result = await query( "UPDATE  Passengerqueue SET WaitingCount = ?,Status = ? WHERE id = ?",
  [WaitingCount,Status,id]
      );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Taxi not found" });
    }

    res.json({ message: "Taxi updated successfully" });
  } catch (err) {
    console.error("Update taxi error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
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








