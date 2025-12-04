
// import express from "express";
// import {db } from "./server.js"; 
// import jwt from "jsonwebtoken";
// import { query } from "./index.js";
// const router = express.Router();

// function verifyToken(req, res, next) {
//   const authHeader = req.headers["authorization"];
//   if (!authHeader) return res.status(401).json({ message: "No token provided" });

//   const token = authHeader.split(" ")[1];
//   jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
//     if (err) return res.status(403).json({ message: "Invalid token" });
//     req.user = decoded;
//     next();
//   });
// }

// router.post("/",verifyToken, async (req, res)  => {
//    const { DriversName, LicenceNo, PlateNo, route_id} = req.body;
//    if (req.user.role !== "dispacher") return res.status(403).json({ message: "Forbidden" });
 

//   if (! DriversName || !LicenceNo || !PlateNo) {
//     return res.status(400).json({ message: "All fields are required" });
//   }
//   try {
//     const result = await query(
//    "INSERT INTO taxis (DriversName,LicenceNo,PlateNo,route_id ) VALUES (?, ?, ?, ?)",
//    [DriversName, LicenceNo,PlateNo, route_id]
//    );
//      res.json({ message: "taxi created", id: result.insertId });
//   } catch (err) {
//     console.error("Create taxi error:", err);
//     res.status(500).json({ message: err.sqlMessage || err.message });
//   }
// });


// router.get("/", verifyToken, async (req, res) => {
//    if (req.user.role !== "dispacher") return res.status(403).json({ message: "Forbidden" });
//  try {
//     const rows = await query(
//       "SELECT * FROM taxis WHERE route_id = ?",
//       [req.user.id]
//     );
//     res.json(rows);
//   } catch (err) {
//     console.error("Fetch taxis error:", err);
//     res.status(500).json({ message: err.sqlMessage || err.message });
//   }
// });

// router.put("/:id", (req, res) => {
//   const { id } = req.params;
//   const { DriversName, LicenceNo, PlateNo } = req.body;

//   const sql = "UPDATE taxis SET DriversName = ?,LicenceNo = ?, PlateNo = ? WHERE id = ?";
//   db.query(sql, [DriversName,LicenceNo, PlateNo, id], (err, result) => {
//     if (err) {
//       console.error("❌ Error updating taxi:", err);
//       return res.status(500).json({ message: "Database error", error: err });
//     }

//     if (result.affectedRows === 0)
//       return res.status(404).json({ message: "Taxi not found" });

//     res.json({ message: "✅ Taxi updated successfully" });
//   });
// });


// // ✅ Delete a station
// router.delete("/:id", (req, res) => {
//   const { id } = req.params;
//   const sql = "DELETE  FROM taxis WHERE id = ?";
//   db.query(sql, [id], (err, result) => {
//     if (err) {
//       console.error("❌ Error deleting taxi:", err);
//       return res.status(500).json({ message: "Database error", error: err });
//     }

//     if (result.affectedRows === 0)
//       return res.status(404).json({ message: "Taxi not found" });

//     res.json({ message: "✅ Taxi deleted successfully" });
//   });
// });

// export default router;



import express from "express";
import { db } from "./server.js";
import jwt from "jsonwebtoken";
import { query } from "./index.js";

const router = express.Router();

// Middleware to verify JWT token
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

// Create a new taxi
router.post("/", verifyToken, async (req, res) => {
  const { DriversName, LicenceNo, PlateNo, route} = req.body;

  if (req.user.role !== "dispacher") {
    return res.status(403).json({ message: "Forbidden: only dispatchers can create taxis" });
  }

  if (!DriversName || !LicenceNo || !PlateNo || !route) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const result = await query(
      "INSERT INTO taxis (DriversName, LicenceNo, PlateNo, route, dispacher_id) VALUES (?, ?, ?, ?, ?)",
      [DriversName, LicenceNo, PlateNo, route,req.user.id]
    );

    res.status(201).json({ message: "Taxi created successfully", id: result.insertId });
  } catch (err) {
    console.error("Create taxi error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});




// router.get("/", verifyToken, async (req, res) => {
//   if (req.user.role !== "dispacher") {
//     return res.status(403).json({ message: "Forbidden: only dispatchers can view taxis" });
//   }

//   try {
//     const rows = await query(
//       "SELECT PlateNo FROM taxis WHERE dispacher_id = ?",
//       [req.user.id]
//     );

//     res.json(rows);

//   } catch (err) {
//     console.error("Fetch taxis error:", err);
//     res.status(500).json({ message: err.sqlMessage || err.message });
//   }
// });

router.get("/", verifyToken, async (req, res) => {
  if (req.user.role !== "dispacher") {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const { route } = req.query;

    if (!route) {
      return res.status(400).json({ message: "Route is required" });
    }

    // normalize dispatcher route
    const [startD, endD] = route.split("→").map(s => s.trim());
    const normalizedDispatcherRoute = [startD, endD].sort().join(" | ");

    // get all taxis
    const rows = await query("SELECT PlateNo, route FROM taxis");

    // filter only vice-versa matches
    const filtered = rows.filter(taxi => {
      if (!taxi.route) return false;

      const [start, end] = taxi.route.split("→").map(s => s.trim());
      const normalizedTaxiRoute = [start, end].sort().join(" | ");

      return normalizedTaxiRoute === normalizedDispatcherRoute;
    });

    res.json(filtered);

  } catch (err) {
    console.error("Fetch taxis error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});




// Update taxi
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { DriversName, LicenceNo, PlateNo } = req.body;

  try {
    const result = await query(
      "UPDATE taxis SET DriversName = ?, LicenceNo = ?, PlateNo = ? WHERE id = ?",
      [DriversName, LicenceNo, PlateNo, id]
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

// Delete taxi
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query("DELETE FROM taxis WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Taxi not found" });
    }

    res.json({ message: "Taxi deleted successfully" });
  } catch (err) {
    console.error("Delete taxi error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

export default router;





