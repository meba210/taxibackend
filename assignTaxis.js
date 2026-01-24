import express from 'express';
import { query } from './index.js';
import jwt from 'jsonwebtoken';
import { db, io } from './server.js';
import { verifyToken } from './index.js';

const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  const { taxi_ids, from_route, to_route } = req.body;
  if (!taxi_ids || !from_route || !to_route)
    return res.status(400).json({ message: 'PlateNo or route required' });

  try {
    const routeResult = await query(
      'SELECT station_name, EndTerminal FROM routes WHERE id = ?',
      [to_route]
    );

    if (routeResult.length === 0) {
      return res.status(404).json({ message: 'Route not found' });
    }

    const routeName = `${routeResult[0].station_name} → ${routeResult[0].EndTerminal}`;

    for (const plateNo of taxi_ids) {
      await query(
        'INSERT INTO assigntaxi (PlateNo,from_route,to_route) VALUES (?, ?, ?)',
        [plateNo, from_route, routeName]
      );
    }

    console.log('+++++++>>>>>>>>', from_route);

    io.to(`route:${from_route}`).emit('taxi:assigned', {
      from_route,
    });

    res.json({ message: 'Taxi assigned successfully' });
  } catch (err) {
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const routeName = req.query.route;

    if (!routeName) {
      return res.status(400).json({ message: 'route parameter is required' });
    }

    const rows = await query(
      `
     SELECT 
          t.id,
          t.PlateNo,
         t.route,
         t.Status
     FROM taxi_queue t
       WHERE route = ? AND Status = 'available'
  ORDER BY t.PlateNo ASC
      `,
      [routeName]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/assignedTaxis', verifyToken, async (req, res) => {
  const { route } = req.query;
  if (!route) return res.status(400).json({ message: 'Route required' });

  try {
    const taxis = await query('SELECT * FROM assigntaxi WHERE to_route = ?', [
      route,
    ]);
    res.json(taxis);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/assigned', verifyToken, async (req, res) => {
  const { route } = req.query;
  if (!route) return res.status(400).json({ message: 'Route required' });

  try {
    const rows = await query(
      'SELECT PlateNo, from_route,Status,to_route FROM assigntaxi'
      //[route]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/fetch-taxi/:plateNo', verifyToken, async (req, res) => {
  const { plateNo } = req.params;
  if (!plateNo) {
    return res.status(400).json({ message: 'Plate number required' });
  }

  try {
    const rows = await query('SELECT * FROM taxis WHERE PlateNo = ?', [
      plateNo,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Taxi not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/fetch-notifications', verifyToken, async (req, res) => {
  try {
    const { route } = req.query;

    if (!route) {
      return res.status(400).json({
        success: false,
        message: 'Route is required',
      });
    }

    const notifications = await query(
      `SELECT 
        id,
        plateNo,
        from_route AS fromRoute,
        to_route AS toRoute,
        status,
        DATE_FORMAT(time, '%H:%i') AS time
      FROM assigntaxi
      WHERE to_route = ?
        AND dispatcher_read = 0
      ORDER BY time DESC`,
      [route]
    );

    return res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
    });
  }
});

router.post('/notifications/read', async (req, res) => {
  const { notificationIds } = req.body;

  await db.query(
    `
    UPDATE assigntaxi 
    SET dispatcher_read = 1 
    WHERE id IN (?)
  `,
    [notificationIds]
  );

  res.json({ success: true });
});

router.delete('/:plateNo', verifyToken, async (req, res) => {
  const { plateNo } = req.params;

  try {
    await query('DELETE FROM assigntaxi WHERE PlateNo =?', [plateNo]);
    res.json({ message: 'Taxi removed from assigned list' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
