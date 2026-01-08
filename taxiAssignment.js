import express from 'express';
import { query } from './index.js';
import jwt from 'jsonwebtoken';
import { verifyToken } from './index.js';

const router = express.Router();

router.get('/allStationInfo', verifyToken, async (req, res) => {
  try {
    const rows = await query(
      `
      SELECT 
          r.id,
          CONCAT(r.station_name, ' → ', r.EndTerminal) AS Routes,

          -- Available taxis
          (
              SELECT COUNT(*)
              FROM taxi_queue t
              WHERE t.route = CONCAT(r.station_name, ' → ', r.EndTerminal)
              AND t.Status = 'available'
          ) AS Taxis,

          -- Total registered taxis
          (
              SELECT COUNT(*)
              FROM taxis t
              WHERE t.route = CONCAT(r.station_name, ' → ', r.EndTerminal)
          ) AS RegisteredTaxis,

          -- Waiting passengers
          (
              SELECT p.WaitingCount
              FROM passengerqueue p
              WHERE p.route = CONCAT(r.station_name, ' → ', r.EndTerminal)
              LIMIT 1
          ) AS WaitingCount,

          -- Dispatcher name
          (
              SELECT d.FullName
              FROM dispachers d
              WHERE d.Routes = CONCAT(r.station_name, ' → ', r.EndTerminal)
              LIMIT 1
          ) AS Dispatcher

      FROM routes r
      WHERE r.StationAdmins_id = ?;
      `,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error('Fetching error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const rows = await query(
      `
      SELECT 
          r.id,
          CONCAT(r.station_name, ' → ', r.EndTerminal) AS Routes,

          -- Count taxis for this route
          (
              SELECT COUNT(*)
              FROM taxi_queue t
              WHERE t.route = CONCAT(r.station_name, ' → ', r.EndTerminal) AND Status = 'available'
          ) AS Taxis,

          -- Get passenger waiting count
          (
              SELECT p.WaitingCount
              FROM passengerqueue p
              WHERE p.route = CONCAT(r.station_name, ' → ', r.EndTerminal)
               ORDER BY \`Timestamp\` DESC
              LIMIT 1
          ) AS WaitingCount

      FROM routes r
      WHERE r.StationAdmins_id = ?;
      `,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error('Fetching error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

export default router;
