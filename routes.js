import express from 'express';
import { query } from './index.js';
import jwt from 'jsonwebtoken';
import { verifyToken } from './index.js';
const router = express.Router();

router.get('/total', async (req, res) => {
  try {
    const rows = await query(`
      SELECT count(*) AS total
      FROM routes
    `);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// router.post('/', verifyToken, async (req, res) => {
//   const { EndTerminal } = req.body;

//   if (req.user.role !== 'stationAdmin') {
//     return res.status(403).json({ message: 'Forbidden' });
//   }

//   try {
//     const adminResult = await query(
//       'SELECT Stations FROM stationadmins WHERE id = ?',
//       [req.user.id]
//     );

//     if (adminResult.length === 0) {
//       return res.status(404).json({ message: 'Station admin not found' });
//     }

//     const stationName = adminResult[0].Stations;

//     if (!stationName) {
//       return res.status(400).json({
//         message:
//           'Station admin is not assigned to any station. Please assign a station first.',
//       });
//     }

//     const result = await query(
//       'INSERT INTO routes (StationAdmins_id, station_name, EndTerminal) VALUES (?, ?, ?)',
//       [req.user.id, stationName, EndTerminal]
//     );

//     res.json({
//       message: 'Route created successfully',
//       id: result.insertId,
//       station_name: stationName,
//     });
//   } catch (err) {
//     res.status(500).json({ message: err.sqlMessage || err.message });
//   }
// });

router.post('/', verifyToken, async (req, res) => {
  const { EndTerminal } = req.body;

  if (req.user.role !== 'stationAdmin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (!EndTerminal || EndTerminal.trim().length < 2) {
    return res.status(400).json({ message: 'End terminal is required' });
  }

  try {
    const adminResult = await query(
      'SELECT Stations FROM stationadmins WHERE id = ?',
      [req.user.id]
    );

    if (adminResult.length === 0) {
      return res.status(404).json({ message: 'Station admin not found' });
    }

    const stationName = adminResult[0].Stations;

    if (!stationName) {
      return res.status(400).json({
        message:
          'Station admin is not assigned to any station. Please assign a station first.',
      });
    }

    const existingRoute = await query(
      `
      SELECT id 
      FROM routes 
      WHERE station_name = ? AND LOWER(EndTerminal) = LOWER(?)
      `,
      [stationName, EndTerminal.trim()]
    );

    if (existingRoute.length > 0) {
      return res.status(409).json({ message: 'This route already exists' });
    }

    const result = await query(
      `
      INSERT INTO routes (StationAdmins_id, station_name, EndTerminal)
      VALUES (?, ?, ?)
      `,
      [req.user.id, stationName, EndTerminal.trim()]
    );

    res.status(201).json({
      message: 'Route created successfully',
      id: result.insertId,
      station_name: stationName,
    });
  } catch (err) {
    console.error('Create route error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/routesEachStation', verifyToken, async (req, res) => {
  if (req.user.role !== 'stationAdmin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const rows = await query(
      'SELECT count(*) AS total FROM routes WHERE StationAdmins_id = ?',
      [req.user.id]
    );

    res.json(rows[0] || { total: 0 });
  } catch (err) {
    console.error('Fetch total routes error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'stationAdmin')
    return res.status(403).json({ message: 'Forbidden' });

  try {
    const rows = await query(
      'SELECT id, station_name, EndTerminal FROM routes WHERE StationAdmins_id = ?',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch routes error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'stationAdmin')
    return res.status(403).json({ message: 'Forbidden' });
  const { id } = req.params;
  try {
    const rows = await query(
      'SELECT station_name, EndTerminal FROM routes WHERE id=? AND StationAdmins_id=?',
      [id, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch routes error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { EndTerminal } = req.body;

  if (req.user.role !== 'stationAdmin')
    return res.status(403).json({ message: 'Forbidden' });

  try {
    const result = await query(
      'UPDATE routes SET  EndTerminal=? WHERE id=? AND StationAdmins_id=?',
      [EndTerminal, id, req.user.id]
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: 'Route not found or unauthorized' });

    res.json({ message: 'Route updated' });
  } catch (err) {
    console.error('Update route error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'stationAdmin')
    return res.status(403).json({ message: 'Forbidden' });

  try {
    const result = await query(
      'DELETE FROM routes WHERE id=? AND StationAdmins_id=?',
      [id, req.user.id]
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: 'Route not found or unauthorized' });

    res.json({ message: 'Route deleted' });
  } catch (err) {
    console.error('Delete route error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

export default router;
