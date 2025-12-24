import express from 'express';
import { query } from './index.js'; // your db promisified query
import jwt from 'jsonwebtoken';

const router = express.Router();

router.get('/availableTaxiForDashboard', async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        r.from_station,
        COALESCE(t.availableTaxiCount, 0) AS availableTaxiCount,
        COALESCE(p.waitingCount, 0) AS waitingCount
      FROM (
        SELECT DISTINCT TRIM(SUBSTRING_INDEX(route, '→', 1)) AS from_station
        FROM taxi_queue
        UNION
        SELECT DISTINCT TRIM(SUBSTRING_INDEX(route, '→', 1)) AS from_station
        FROM passengerqueue
      ) r
      LEFT JOIN (
        SELECT
          TRIM(SUBSTRING_INDEX(route, '→', 1)) AS from_station,
          COUNT(*) AS availableTaxiCount
        FROM taxi_queue
        WHERE status = 'available'
        GROUP BY from_station
      ) t ON r.from_station = t.from_station
      LEFT JOIN (
        SELECT
          TRIM(SUBSTRING_INDEX(route, '→', 1)) AS from_station,
          SUM(waitingCount) AS waitingCount
        FROM passengerqueue
        GROUP BY from_station
      ) p ON r.from_station = p.from_station
      ORDER BY waitingCount DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader)
    return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

// Add taxi to queue
// router.post("/", verifyToken, async (req, res) => {
//   if (req.user.role !== "dispacher") return res.status(403).json({ message: "Only dispatchers can add taxis" });

//   const { PlateNo,route } = req.body;
//   if (!PlateNo|| !route) return res.status(400).json({ message: "PlateNo required" });

//   try {
//           const existing = await query(
//       "SELECT route FROM taxi_queue WHERE PlateNo = ?",
//       [PlateNo]
//     );

//     if (existing.length > 0) {
//       return res.status(409).json({
//         message: "Taxi is already in the queue",
//         currentRoute: existing[0].route
//       });
//     }

//     await query(
//       "INSERT INTO taxi_queue (PlateNo, dispacher_id,route) VALUES (?, ?, ?)",
//       [PlateNo, req.user.id,route]
//     );
//     res.json({ message: "Taxi added to queue" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: err.sqlMessage || err.message });
//   }
// });

router.post('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'dispacher')
    return res.status(403).json({ message: 'Only dispatchers can add taxis' });

  const { PlateNo, route, status } = req.body;
  if (!PlateNo || !route)
    return res.status(400).json({ message: 'PlateNo and route required' });

  try {
    const existing = await query(
      'SELECT route, Status FROM taxi_queue WHERE PlateNo = ?',
      [PlateNo]
    );

    if (existing.length > 0) {
      const taxi = existing[0];

      if (taxi.status === 'available') {
        return res.status(409).json({
          message: 'Taxi is already in the queue',
          status: taxi.status,
          currentRoute: taxi.route,
        });
      }
    }

    // Add status with default 'available'
    await query(
      'INSERT INTO taxi_queue (PlateNo, dispacher_id, route) VALUES (?, ?, ?)',
      [PlateNo, req.user.id, route]
    );

    res.json({
      message: 'Taxi added to queue',
      status: 'available',
    });

    //    if (existing.length > 0 && status === 'available') {
    //   return res.status(409).json({
    //     message: "Taxi is already in the queue",
    //     currentRoute: existing[0].route
    //   });
    // }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const rows = await query(
      "SELECT PlateNo FROM taxi_queue WHERE  Status = 'available'",
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'dispacher')
    return res.status(403).json({ message: 'Forbidden' });

  try {
    const rows = await query(
      'SELECT PlateNo FROM taxi_queue WHERE dispacher_id = ?',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/availableTaxiseachstation', async (req, res) => {
  try {
    const { route } = req.query;

    if (!route) {
      return res.status(400).json({ message: 'route is required' });
    }

    // extract start station from route
    const startStation = route.split('→')[0].trim();

    const rows = await query(
      `
      SELECT COUNT (*) AS total
      FROM taxi_queue
      WHERE status ='available' AND route LIKE ?
      `[`${startStation} →%`]
    );

    res.json({ total: rows[0].total || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/total', async (req, res) => {
  try {
    const rows = await query(`
      SELECT count(*) AS total
      FROM taxi_queue
    `);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// Add this route to your existing taxi queue routes
router.put('/:taxiId/status', async (req, res) => {
  const { taxiId } = req.params; // This is actually the PlateNo
  const { status } = req.body;

  console.log('Received taxiId (PlateNo):', taxiId);
  console.log('Received status:', status);

  // Validate status
  const validStatuses = ['available', 'assigned'];
  if (!validStatuses.includes(status)) {
    return res
      .status(400)
      .json({ message: "Invalid status. Must be 'available' or 'assigned'" });
  }

  try {
    // Check if taxi exists in queue
    const existing = await query(
      'SELECT PlateNo FROM taxi_queue WHERE PlateNo = ?',
      [taxiId] // Use taxiId here since that's what we're passing
    );

    console.log('Database check result:', existing);

    if (existing.length === 0) {
      return res.status(404).json({
        message: `Taxi ${taxiId} not found in taxi_queue table`,
      });
    }

    // Update the status
    const result = await query(
      'UPDATE taxi_queue SET Status = ? WHERE PlateNo = ?',
      [status, taxiId] // Use taxiId here
    );

    console.log('Update successful, rows affected:', result.affectedRows);

    res.json({
      message: `Taxi ${taxiId} status updated to ${status}`,
      PlateNo: taxiId,
      status,
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

// REMOVE taxi from queue
router.delete('/:PlateNo', verifyToken, async (req, res) => {
  if (req.user.role !== 'dispacher')
    return res
      .status(403)
      .json({ message: 'Only dispatchers can remove taxis' });

  const { PlateNo } = req.params;

  try {
    const result = await query('DELETE FROM taxi_queue WHERE PlateNo = ?', [
      PlateNo,
      req.user.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Taxi not found in your queue' });
    }

    res.json({ message: `Taxi ${PlateNo} removed from queue` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

export default router;
