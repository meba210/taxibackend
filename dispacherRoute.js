import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from './index.js';
import { verifyToken } from './index.js';
const router = express.Router();

router.get('/station', verifyToken, async (req, res) => {
  try {
    const rows = await query('SELECT Routes FROM dispachers WHERE id = ?');

    if (rows.length === 0)
      return res.status(404).json({ message: 'No route assigned' });

    res.json({ route: rows[0].Routes });
  } catch (err) {
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.get('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'dispacher')
    return res.status(403).json({ message: 'Forbidden' });

  try {
    const rows = await query('SELECT Routes FROM dispachers WHERE id = ?', [
      req.user.id,
    ]);

    if (rows.length === 0)
      return res.status(404).json({ message: 'No route assigned' });

    res.json({ route: rows[0].Routes });
  } catch (err) {
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

export default router;
