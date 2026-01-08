import express from 'express';
import { db } from './server.js';
import jwt from 'jsonwebtoken';
import { query } from './index.js';
import { verifyToken } from './index.js';
const router = express.Router();

router.post('/', async (req, res) => {
  const { FullName, Email, PhoneNumber, UserName, selectedStation, role_id } =
    req.body;

  if (!FullName || !Email || !PhoneNumber || !UserName || !selectedStation) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const sql = `
    INSERT INTO stationadmins
      (FullName, Email, PhoneNumber, UserName, Stations, role_id)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      FullName = VALUES(FullName),
      Email = VALUES(Email),
      PhoneNumber = VALUES(PhoneNumber),
      UserName = VALUES(UserName),
      role_id = VALUES(role_id)
  `;

  db.query(
    sql,
    [FullName, Email, PhoneNumber, UserName, selectedStation, role_id],
    (err, result) => {
      if (err) {
        console.error('Error inserting/updating station Admin:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      res.status(200).json({
        message:
          result.affectedRows === 1
            ? 'Admin created successfully'
            : 'Admin updated successfully',
      });
    }
  );
});

router.get('/check-username/:username', verifyToken, async (req, res) => {
  try {
    const { username } = req.params;

    const stationAdmin = await StationAdmin.findOne({
      where: {
        UserName: username.toLowerCase().trim(),
      },
    });
    res.json({
      available: !stationAdmin,
      message: stationAdmin ? 'Username already exists' : 'Username available',
    });
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({ message: 'Error checking username availability' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const sql = 'SELECT * FROM stationadmins';

    db.query(sql, (err, results) => {
      if (err) {
        console.error('Fetching error:', err);
        return res.status(500).json({
          message: err.sqlMessage || err.message,
        });
      }

      res.status(200).json(results);
    });
  } catch (err) {
    console.error('Fetching error:', err);
    res.status(500).json({
      message: err.sqlMessage || err.message,
    });
  }
});

router.get('/stationadmin-stations', verifyToken, async (req, res) => {
  if (req.user.role !== 'stationAdmin')
    return res.status(403).json({ message: 'Forbidden' });

  try {
    const rows = await query(
      'SELECT Stations,FullName FROM stationadmins WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: 'No route assigned' });

    res.json({
      station: rows[0].Stations,
      name: rows[0].FullName,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/total', async (req, res) => {
  const sql = 'SELECT COUNT(*) AS total FROM stationadmins';

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(200).json(results[0]);
  });
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sql = 'SELECT * FROM stationadmins WHERE id = ?';

    db.query(sql, [id], (err, results) => {
      if (err) {
        return res.status(500).json({
          message: err.sqlMessage || err.message,
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          message: 'Station admin not found',
        });
      }

      res.status(200).json(results[0]);
    });
  } catch (err) {
    res.status(500).json({
      message: err.sqlMessage || err.message,
    });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { FullName, Email, PhoneNumber, UserName } = req.body;

  const sql = `
    UPDATE stationadmins 
    SET FullName=?, Email=?, PhoneNumber=?, UserName=?
    WHERE id=?
  `;
  db.query(sql, [FullName, Email, PhoneNumber, UserName, id], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: 'Station Admin not found' });

    res.json({ message: 'Station Admin updated successfully' });
  });
});

router.put('/:id/changePassword', verifyToken, (req, res) => {
  if (req.user.role !== 'stationAdmin')
    return res.status(403).json({ message: 'Forbidden' });

  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  const getSql = 'SELECT Password FROM stationadmins WHERE id = ?';
  db.query(getSql, [id], (err, results) => {
    if (err)
      return res.status(500).json({ success: false, message: 'Server error' });
    if (results.length === 0)
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });

    const storedPassword = results[0].Password;

    if (currentPassword !== storedPassword) {
      return res
        .status(401)
        .json({ success: false, message: 'Current password is incorrect' });
    }
    const updateSql =
      'UPDATE stationadmins SET Password = ?, mustChangePassword = 0 WHERE id = ?';
    db.query(updateSql, [newPassword, id], (updateErr, result) => {
      if (updateErr)
        return res
          .status(500)
          .json({ success: false, message: 'Failed to update password' });

      res.json({ success: true, message: 'Password updated successfully' });
    });
  });
});

router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE  FROM stationadmins WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error('Error deleting station:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: ' Station Admin not found' });

    res.json({ message: 'Station Admin deleted successfully' });
  });
});

export default router;
