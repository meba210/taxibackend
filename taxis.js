import express from "express";
import { db } from "./server.js";
import jwt from "jsonwebtoken";
import { query } from "./index.js";

const router = express.Router();


router.get("/total", async (req, res) => {
  try {
    const rows = await query(`
      SELECT count(*) AS count
      FROM taxis
    `);

    res.json(rows[0]); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});




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
  const { DriversName,PhoneNo, LicenceNo, PlateNo, route} = req.body;

  if (req.user.role !== "dispacher") {
    return res.status(403).json({ message: "Forbidden: only dispatchers can create taxis" });
  }

  if (!DriversName || !PhoneNo|| !LicenceNo || !PlateNo || !route) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const result = await query(
      "INSERT INTO taxis (DriversName,PhoneNo, LicenceNo, PlateNo, route, dispacher_id) VALUES (?, ?, ?, ?, ?, ?)",
      [DriversName,PhoneNo, LicenceNo, PlateNo, route,req.user.id]
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
router.get("/taxisDetail/:id", verifyToken, async (req, res) => {
  if (req.user.role !== "dispacher") {
    return res.status(403).json({
      message: "Forbidden: only dispatchers can see taxi detail",
    });
  }

  const { id } = req.params;

  try {
    const rows = await query(
      "SELECT * FROM taxis WHERE id = ?",
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Taxi not found" });
    }

    res.json(rows[0]); // ✅ RETURN SINGLE OBJECT
  } catch (err) {
    console.error("Fetch taxi detail error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});


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
    const rows = await query("SELECT * FROM taxis");

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



router.get("/eachstation", verifyToken, async (req, res) => {
  try {
    const { route } = req.query;

    if (!route) {
      return res.status(400).json({ message: "route is required" });
    }

    // extract start station from route
    const startStation = route.split("→")[0].trim();

    const rows = await query(
      `
      SELECT COUNT (*) AS total
      FROM taxis
      WHERE route LIKE ?
      `,
      [`${startStation} →%`]
    );

    res.json({ total: rows[0].total || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/available", verifyToken, async (req, res) => {
  if (req.user.role !== "dispacher") {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const { route } = req.query;

    if (!route) {
      return res.status(400).json({ message: "Route is required" });
    }

    // Parse the route
    const [startD, endD] = route.split("→").map(s => s.trim());
    
    // Get count of taxis that match either direction
    const result = await query(
      `SELECT COUNT(*) AS count 
       FROM taxis 
       WHERE (route = ? OR route = ?)`,
      [`${startD} → ${endD}`, `${endD} → ${startD}`]
    );

    const count = result[0].count;

    // If you need the actual taxis too:
    const taxis = await query(
      `SELECT id, PlateNo, route 
       FROM taxis 
       WHERE (route = ? OR route = ?)`,
      [`${startD} → ${endD}`, `${endD} → ${startD}`]
    );

    res.json({ 
      count: count,
      taxis: taxis, // Include taxis if needed
      normalized_route: `${startD} | ${endD}`,
      original_route: route,
      message: `Found ${count} taxis for route ${route} (vice-versa)`
    });

  } catch (err) {
    console.error("Count taxis error:", err);
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





