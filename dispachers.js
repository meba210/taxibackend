import express from 'express';
import { db } from './server.js';
import jwt from 'jsonwebtoken';
import { query } from './index.js';
import { verifyToken } from './index.js';
const router = express.Router();

router.get('/total', async (req, res) => {
  try {
    const rows = await query(`
      SELECT count(*) AS total
      FROM dispachers
    `);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  const { FullName, Email, PhoneNumber, UserName, Routes, role_id } = req.body;

  if (req.user.role !== 'stationAdmin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (!FullName || !Email || !PhoneNumber || !UserName || !Routes) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const sql = `
      INSERT INTO dispachers
        (FullName, Email, PhoneNumber, UserName, Routes, role_id, StationAdmins_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        FullName = VALUES(FullName),
        Email = VALUES(Email),
        PhoneNumber = VALUES(PhoneNumber),
        UserName = VALUES(UserName),
        role_id = VALUES(role_id),
        StationAdmins_id = VALUES(StationAdmins_id)
    `;

    const result = await query(sql, [
      FullName,
      Email,
      PhoneNumber,
      UserName,
      Routes,
      role_id,
      req.user.id,
    ]);

    res.json({
      message:
        result.affectedRows === 1
          ? 'Dispatcher created successfully'
          : 'Dispatcher updated successfully',
      id: result.insertId,
    });
  } catch (err) {
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/dispachersEachStation', verifyToken, async (req, res) => {
  if (req.user.role !== 'stationAdmin')
    return res.status(403).json({ message: 'Forbidden' });

  try {
    const rows = await query(
      ' SELECT count(*) AS total FROM dispachers WHERE StationAdmins_id = ?',
      [req.user.id]
    );
    res.json(rows[0] || { total: 0 });
  } catch (err) {
    console.error('Fetch dispachers error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/check-username/:username', verifyToken, async (req, res) => {
  try {
    const { username } = req.params;
    const dispatcher = await Dispatcher.findOne({
      where: {
        UserName: username.toLowerCase(),
      },
    });
    res.json({ available: !dispatcher });
  } catch (error) {
    res.status(500).json({ message: 'Error checking username' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'stationAdmin')
    return res.status(403).json({ message: 'Forbidden' });

  try {
    const rows = await query(
      'SELECT * FROM dispachers WHERE StationAdmins_id = ?',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch dispachers error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'stationAdmin')
    return res.status(403).json({ message: 'Forbidden' });
  const { id } = req.params;
  try {
    const rows = await query(
      'SELECT * FROM dispachers WHERE id=? AND StationAdmins_id = ?',
      [id, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch dispachers error:', err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { FullName, Email, PhoneNumber, UserName } = req.body;

  const sql =
    'UPDATE dispachers SET FullName = ?, Email= ?, PhoneNumber = ? ,UserName= ?  WHERE id = ?';
  db.query(sql, [FullName, Email, PhoneNumber, UserName, id], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: 'dispachers not found' });

    res.json({ message: 'dispacher updated successfully' });
  });
});

router.put('/:id/changePassword', verifyToken, (req, res) => {
  if (req.user.role !== 'dispacher')
    return res.status(403).json({ message: 'Forbidden' });

  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  const getSql = 'SELECT Password FROM dispachers WHERE id = ?';
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
      'UPDATE dispachers SET Password = ?, mustChangePassword = 0 WHERE id = ?';
    db.query(updateSql, [newPassword, id], (updateErr, result) => {
      if (updateErr)
        return res
          .status(500)
          .json({ success: false, message: 'Failed to update password' });

      res.json({ success: true, message: ' Password updated successfully' });
    });
  });
});

router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE  FROM dispachers WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: 'dispachers not found' });

    res.json({ message: 'dispachers deleted successfully' });
  });
});

export default router;
