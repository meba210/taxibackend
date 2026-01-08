import express from 'express';
import { db } from './server.js';
import jwt from 'jsonwebtoken';
import { query } from './index.js';
import { verifyToken } from './index.js';
const router = express.Router();

router.get('/total', async (req, res) => {
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

router.get('/existing-records', verifyToken, async (req, res) => {
  try {
    const allTaxis = await query('SELECT LicenceNo, PlateNo FROM taxis');

    if (!allTaxis || allTaxis.length === 0) {
      return res.json({
        success: true,
        message: 'No existing records found',
        data: { licenceNos: [], plateNos: [] },
      });
    }

    const licenceNos = [
      ...new Set(allTaxis.map((taxi) => taxi.LicenceNo).filter(Boolean)),
    ];
    const plateNos = [
      ...new Set(allTaxis.map((taxi) => taxi.PlateNo).filter(Boolean)),
    ];

    res.json({
      success: true,
      message: 'Fetched existing records successfully',
      data: { licenceNos, plateNos },
    });
  } catch (error) {
    console.error('Error fetching existing records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch existing records',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

router.post('/', verifyToken, async (req, res) => {
  const { DriversName, PhoneNo, LicenceNo, PlateNo, route } = req.body;

  if (req.user.role !== 'dispacher') {
    return res
      .status(403)
      .json({ message: 'Forbidden: only dispatchers can create taxis' });
  }

  if (!DriversName || !PhoneNo || !LicenceNo || !PlateNo || !route) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const result = await query(
      'INSERT INTO taxis (DriversName,PhoneNo, LicenceNo, PlateNo, route, dispacher_id) VALUES (?, ?, ?, ?, ?, ?)',
      [DriversName, PhoneNo, LicenceNo, PlateNo, route, req.user.id]
    );

    res
      .status(201)
      .json({ message: 'Taxi created successfully', id: result.insertId });
  } catch (err) {
    console.error('Create taxi error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/allTaxis', (req, res) => {
  db.query('SELECT * FROM taxis', (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(200).json(results);
  });
});

router.get('/taxisDetail/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'dispacher') {
    return res.status(403).json({
      message: 'Forbidden: only dispatchers can see taxi detail',
    });
  }

  const { id } = req.params;

  try {
    const rows = await query('SELECT * FROM taxis WHERE id = ?', [
      id,
      req.user.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Taxi not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Fetch taxi detail error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'dispacher') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const { route } = req.query;

    if (!route) {
      return res.status(400).json({ message: 'Route is required' });
    }
    const [startD, endD] = route.split('→').map((s) => s.trim());
    const normalizedDispatcherRoute = [startD, endD].sort().join(' | ');

    const rows = await query(`
      SELECT 
        t.*,
        EXISTS (
          SELECT 1
          FROM taxi_queue tq
          WHERE tq.PlateNo = t.PlateNo
            AND tq.is_taxi_used = 1
            AND tq.status = 'assigned'
        ) AS isQueued
      FROM taxis t
      WHERE t.status = 'verified'
    `);

    const filtered = rows.filter((taxi) => {
      if (!taxi.route) return false;

      const [start, end] = taxi.route.split('→').map((s) => s.trim());
      const normalizedTaxiRoute = [start, end].sort().join(' | ');

      return normalizedTaxiRoute === normalizedDispatcherRoute;
    });

    res.json(filtered);
  } catch (err) {
    console.error('Fetch taxis error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
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
       FROM taxis_queue
       WHERE (route = ? OR route = ?)`,
      [`${startD} → ${endD}`, `${endD} → ${startD}`]
    );

    const count = result[0].count;

    const taxis = await query(
      `SELECT id, PlateNo, route 
       FROM taxis 
       WHERE (route = ? OR route = ?)`,
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

router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['verified', 'unverified'].includes(status)) {
    return res
      .status(400)
      .json({ message: "Status must be 'verified' or 'unverified'" });
  }

  const sql = 'UPDATE taxis SET status = ? WHERE id = ?';
  db.query(sql, [status, id], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: 'taxi not found' });

    res.json({
      message: ` taxi ${status} successfully`,
      status: status,
    });
  });
});

router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  let { DriversName, LicenceNo, PlateNo, PhoneNo } = req.body;
  DriversName = String(DriversName || '').trim();
  LicenceNo = String(LicenceNo || '').trim();
  PlateNo = String(PlateNo || '').trim();
  PhoneNo = String(PhoneNo || '').trim();

  if (!DriversName || !LicenceNo || !PlateNo || !PhoneNo) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const existingLicence = await query(
      'SELECT id FROM taxis WHERE LicenceNo = ? AND id != ?',
      [LicenceNo, id]
    );

    if (existingLicence.length > 0) {
      return res.status(400).json({ message: 'Licence number already exists' });
    }
    const existingPlate = await query(
      'SELECT id FROM taxis WHERE PlateNo = ? AND id != ?',
      [PlateNo, id]
    );

    if (existingPlate.length > 0) {
      return res.status(400).json({ message: 'Plate number already exists' });
    }
    if (!/^\+2519\d{8}$/.test(PhoneNo.replace(/\s/g, ''))) {
      return res
        .status(400)
        .json({ message: 'Invalid phone number format. Use +2519XXXXXXXX' });
    }
    if (!/^\d{6}$/.test(LicenceNo)) {
      return res
        .status(400)
        .json({ message: 'Licence number must be exactly 6 digits' });
    }
    if (!/^\d{5}$/.test(PlateNo)) {
      return res
        .status(400)
        .json({ message: 'Plate number must be exactly 5 digits' });
    }

    const result = await query(
      'UPDATE taxis SET DriversName = ?, LicenceNo = ?, PlateNo = ?, PhoneNo = ? WHERE id = ?',
      [DriversName.trim(), LicenceNo, PlateNo, PhoneNo.replace(/\s/g, ''), id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Taxi not found' });
    }

    res.json({
      message: 'Taxi updated successfully',
      taxi: {
        id,
        DriversName: DriversName.trim(),
        LicenceNo,
        PlateNo,
        PhoneNo: PhoneNo.replace(/\s/g, ''),
      },
    });
  } catch (err) {
    console.error('Update taxi error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query('DELETE FROM taxis WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Taxi not found' });
    }

    res.json({ message: 'Taxi deleted successfully' });
  } catch (err) {
    console.error('Delete taxi error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/plate/:plateNo', verifyToken, async (req, res) => {
  const { plateNo } = req.params;

  const rows = await query('SELECT * FROM taxis WHERE PlateNo = ? LIMIT 1', [
    plateNo,
  ]);

  if (!rows.length) {
    return res.status(404).json({ message: 'Taxi not found' });
  }

  res.json(rows[0]);
});

export default router;
