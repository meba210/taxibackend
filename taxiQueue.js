import express from 'express';
import { query } from './index.js';
import jwt from 'jsonwebtoken';
import { verifyToken } from './index.js';
const router = express.Router();

router.get('/total', async (req, res) => {
  try {
    const rows = await query(`
      SELECT count(*) AS total
      FROM taxi_queue
    `);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/available', verifyToken, async (req, res) => {
  if (req.user.role !== 'dispacher') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const { currentRoute } = req.query;

    if (!currentRoute) {
      return res.status(400).json({ message: 'Route is required' });
    }
    const [startD, endD] = currentRoute.split('→').map((s) => s.trim());
    const result = await query(
      `SELECT COUNT(*) AS count 
       FROM taxi_queue
       WHERE (route = ? OR route = ?) AND status="available"`,
      [`${startD} → ${endD}`, `${endD} → ${startD}`]
    );

    const count = result[0].count;
    const taxis = await query(
      `SELECT id, PlateNo, route 
       FROM taxi_queue
       WHERE (route = ? OR route = ?) AND status="available"`,
      [`${startD} → ${endD}`, `${endD} → ${startD}`]
    );

    res.json({
      count: count,
      taxis: taxis,
      normalized_route: `${startD} | ${endD}`,
      original_route: currentRoute,
      message: `Found ${count} taxis for route ${currentRoute} (vice-versa)`,
    });
  } catch (err) {
    console.error('Count taxis error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/availableTaxiseachstation', async (req, res) => {
  try {
    const { route } = req.query;

    if (!route) {
      return res.status(400).json({ message: 'route is required' });
    }

    const startStation = route.split('→')[0].trim();

    const rows = await query(
      `
      SELECT COUNT (*) AS total
      FROM taxi_queue
      WHERE status ='available' AND route LIKE ?
      `,
      [`${startStation} →%`]
    );

    res.json({ total: rows[0].total || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

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

    await query(
      'INSERT INTO taxi_queue (PlateNo, dispacher_id, route, is_taxi_used) VALUES (?, ?, ?, 1)',
      [PlateNo, req.user.id, route]
    );

    await query(`UPDATE assigntaxi SET is_taxi_used = 1 WHERE PlateNo = ?`, [
      PlateNo,
    ]);

    res.json({
      message: 'Taxi added to queue',
      status: 'available',
    });
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

router.put('/:taxiId/status', async (req, res) => {
  const { taxiId } = req.params;
  const { status } = req.body;
  const validStatuses = ['available', 'assigned'];
  if (!validStatuses.includes(status)) {
    return res
      .status(400)
      .json({ message: "Invalid status. Must be 'available' or 'assigned'" });
  }

  try {
    const existing = await query(
      'SELECT PlateNo FROM taxi_queue WHERE PlateNo = ?',
      [taxiId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        message: `Taxi ${taxiId} not found in taxi_queue table`,
      });
    }
    const result = await query(
      'UPDATE taxi_queue SET Status = ? WHERE PlateNo = ?',
      [status, taxiId]
    );

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
