import express from "express";
import { query } from "./index.js";
import jwt from "jsonwebtoken";

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

router.post("/", verifyToken, async (req, res) => {
  const { taxi_ids, to_route } = req.body;
  if (!taxi_ids || !to_route)
    return res.status(400).json({ message: "PlateNo or route required" });

  try {
    // 1. Get route name from routes table
    const routeResult = await query(
      "SELECT StartTerminal, EndTerminal FROM routes WHERE id = ?",
      [to_route]
    );

    if (routeResult.length === 0) {
      return res.status(404).json({ message: "Route not found" });
    }

    const routeName = `${routeResult[0].StartTerminal} → ${routeResult[0].EndTerminal}`;

    // 2. Insert each taxi into assignTaxi table with route name
    for (const plateNo of taxi_ids) {
      await query(
        "INSERT INTO assigntaxi (PlateNo, route) VALUES (?, ?)",
        [plateNo, routeName]
      );
    }

    res.json({ message: "Taxi assigned successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get("/", verifyToken, async (req, res) => {
  try {
    const routeName = req.query.route;

    if (!routeName) {
      return res.status(400).json({ message: "route parameter is required" });
    }

    const rows = await query(
        `
     SELECT 
          t.id,
          t.PlateNo,
         t.route
     FROM taxi_queue t
       WHERE route = ?
  ORDER BY t.PlateNo ASC
      `,
      [routeName]
    );

    res.json(rows);
  } catch (err) {
    console.error("Fetching error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get("/assignedTaxis", verifyToken, async (req, res) => {
  const { route } = req.query;
  if (!route) return res.status(400).json({ message: "Route required" });

  try {
    const taxis = await query("SELECT PlateNo FROM assigntaxi WHERE route = ?", [route]);
    res.json(taxis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});



router.get("/assigned", verifyToken, async (req, res) => {
  const { route } = req.query;
  if (!route) return res.status(400).json({ message: "Route required" });

  try {
    const rows = await query(
      "SELECT PlateNo, Status FROM assigntaxi WHERE route = ?",
      [route]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
