// import express from "express";
// import { db } from "./server.js";
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

// // router.get("/", verifyToken, async (req, res) => {
// //     try {
// //     const rows = await query( `
// //        SELECT 
// //     r.id,
// //     CONCAT(r.StartTerminal, ' → ', r.EndTerminal) AS Routes,
// //     (
// //         SELECT COUNT(*)
// //         FROM taxi_queue t
// //         WHERE dispacher_id = ?
// //     ) AS Taxis
// // FROM routes r;

// //     `
     
// //     );
// //  res.json(rows);

// //   } catch (err) {
// //     console.error("Fetching error:", err);
// //     res.status(500).json({ message: err.sqlMessage || err.message });
// //   }
// // });

// // export default router;


// router.get("/", verifyToken, async (req, res) => {
//   try {
//     const rows = await query(
//       `
//       SELECT 
//           r.id,
//           CONCAT(r.StartTerminal, ' → ', r.EndTerminal) AS Routes,
//           (
//               SELECT COUNT(*)
//               FROM taxi_queue t
//               WHERE t.dispacher_id = r.StationAdmins_id
//                 AND t.route = r
//           ) AS Taxis
//       FROM routes r
//       WHERE r.StationAdmins_id= ?;
//       `,
//       [req.user.id]
//     );

//     res.json(rows);
//   } catch (err) {
//     console.error("Fetching error:", err);
//     res.status(500).json({ message: err.sqlMessage || err.message });
//   }
// });


// export default router;



import express from "express";
import { query } from "./index.js"; // your db promisified query
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

// Fetch routes for the current station admin with taxis count
router.get("/", verifyToken, async (req, res) => {
  try {
    const rows = await query(
      `
      SELECT 
          r.id,
          CONCAT(r.StartTerminal, ' → ', r.EndTerminal) AS Routes,
          (
              SELECT COUNT(*) 
              FROM taxi_queue t
              WHERE t.route = CONCAT(r.StartTerminal, ' → ', r.EndTerminal)
          ) AS Taxis
      FROM routes r
      WHERE r.StationAdmins_id = ?;
      `,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Fetching error:", err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

export default router;
