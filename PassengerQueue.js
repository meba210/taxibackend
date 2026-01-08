import express from 'express';
import { db } from './server.js';
import jwt from 'jsonwebtoken';
import { query } from './index.js';
import { verifyToken } from './index.js';
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    const waitingCount = Number(req.body.waiting_count);

    if (Number.isNaN(waitingCount)) {
      return res.status(400).json({ message: 'Invalid waiting count' });
    }

    // fetch dispatcher route
    const [row] = await query('SELECT Routes FROM dispachers WHERE id = ?', [
      req.user.id,
    ]);

    if (!row?.Routes) {
      return res
        .status(400)
        .json({ message: 'Dispatcher route not assigned hfhfhfhfh' });
    }

    const route = row.Routes;

    const existing = await query(
      `
      SELECT id FROM passengerqueue
      WHERE route = ?
      AND DATE(Timestamp) = CURRENT_DATE
      `,
      [route]
    );

    if (existing.length > 0) {
      await query(
        `
        UPDATE passengerqueue
        SET WaitingCount = ?
        WHERE id = ?
        `,
        [waitingCount, existing[0].id]
      );

      return res.json({
        id: existing[0].id,
        action: 'updated',
      });
    }

    const result = await query(
      `
      INSERT INTO passengerqueue (dispacher_id, WaitingCount, route, Timestamp)
      VALUES (?, ?, ?, NOW())
      `,
      [req.user.id, waitingCount, route]
    );

    res.json({
      id: result.insertId,
      action: 'created',
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/passengerWaitingByDestination', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'stationAdmin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const adminId = req.user.id;

    const rows = await query(
      `
      SELECT
        DATE(pq.Timestamp) AS date,
        pq.route AS route,
        SUM(pq.WaitingCount) AS totalWaiting
        FROM passengerqueue pq
        JOIN stationadmins sa ON sa.id = ?
        WHERE TRIM(SUBSTRING_INDEX(pq.route, '→', 1)) = sa.Stations
        GROUP BY date, route
        ORDER BY date ASC, route ASC
      `,
      [adminId]
    );

    res.json(
      rows.map((r) => ({
        date: r.date,
        route: r.route,
        totalWaiting: Number(r.totalWaiting),
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const rows = await query(`
      SELECT SUM(WaitingCount) AS total
      FROM passengerqueue
    `);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/eachstation', verifyToken, async (req, res) => {
  try {
    const { route } = req.query;

    if (!route) {
      return res.status(400).json({ message: 'route is required' });
    }

    const startStation = route.split('→')[0].trim();

    const rows = await query(
      `
      SELECT SUM(WaitingCount) AS total
      FROM passengerqueue
      WHERE route LIKE ?
      `,
      [`${startStation} →%`]
    );

    res.json({ total: rows[0].total || 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/passengerWaitingTrendStation', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'stationAdmin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const adminId = req.user.id;

    const rows = await query(
      `
      SELECT
        DATE_FORMAT(pq.Timestamp, '%Y-%m-%d %H:00') AS time_bucket,
        SUM(pq.WaitingCount) AS totalWaiting
        FROM passengerqueue pq
        JOIN stationadmins sa
          ON sa.id = ?
        WHERE TRIM(SUBSTRING_INDEX(pq.route, '→', 1)) = sa.Stations
        GROUP BY time_bucket
        ORDER BY time_bucket ASC
      `,
      [adminId]
    );

    res.json(
      rows.map((r) => ({
        time: r.time_bucket,
        totalWaiting: Number(r.totalWaiting),
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/passengerWaitingTrend', async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        DATE_FORMAT(Timestamp, '%Y-%m-%d %H:00') AS time_bucket,
        SUM(WaitingCount) AS totalWaiting
        FROM passengerqueue
        GROUP BY time_bucket
        ORDER BY time_bucket ASC
      `);

    res.json(
      rows.map((r) => ({
        time: r.time_bucket,
        totalWaiting: Number(r.totalWaiting),
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/current', verifyToken, async (req, res) => {
  if (req.user.role !== 'dispacher') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const rows = await query(
      `SELECT WaitingCount 
      FROM passengerqueue
      WHERE dispacher_id = ? 
      ORDER BY \`Timestamp\` DESC
      LIMIT 1
    `,
      [req.user.id]
    );

    res.json({ count: rows[0]?.WaitingCount || 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { WaitingCount, Status } = req.body;

  try {
    const result = await query(
      'UPDATE  Passengerqueue SET WaitingCount = ?,Status = ? WHERE id = ?',
      [WaitingCount, Status, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Taxi not found' });
    }

    res.json({ message: 'Taxi updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE  FROM  Passengerqueue WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: 'data not found' });

    res.json({ message: 'data deleted successfully' });
  });
});

export default router;
