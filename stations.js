import express from 'express';
import { db } from './server.js';
import { verifyToken } from './index.js';
const router = express.Router();

router.post('/', (req, res) => {
  const { StationName, City, location } = req.body;

  db.query(
    'SELECT id FROM stations WHERE StationName = ?',
    [StationName],
    (err, existing) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (existing.length > 0) {
        return res.status(409).json({ message: 'This station already exists' });
      }

      db.query(
        'INSERT INTO stations (StationName, City, location) VALUES (?, ?, ?)',
        [StationName, City, location],
        (err) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Database error' });
          }

          res.status(201).json({ message: 'Station created successfully' });
        }
      );
    }
  );
});

router.get('/total', async (req, res) => {
  const sql = 'SELECT COUNT(*) AS total FROM stations';

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(200).json(results[0]);
  });
});

router.get('/', (req, res) => {
  db.query('SELECT * FROM stations', (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(200).json(results);
  });
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sql = 'SELECT * FROM stations WHERE id = ?';

    db.query(sql, [id], (err, results) => {
      if (err) {
        console.error('Fetching error:', err);
        return res.status(500).json({
          message: err.sqlMessage || err.message,
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          message: 'Station not found',
        });
      }

      res.status(200).json(results[0]);
    });
  } catch (err) {
    console.error('Fetching error:', err);
    res.status(500).json({
      message: err.sqlMessage || err.message,
    });
  }
});

router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['active', 'inactive'].includes(status)) {
    return res
      .status(400)
      .json({ message: "Status must be 'active' or 'inactive'" });
  }

  const sql = 'UPDATE stations SET status = ? WHERE id = ?';
  db.query(sql, [status, id], (err, result) => {
    if (err) {
      console.error('Error updating station status:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: 'Station not found' });

    res.json({
      message: `✅ Station ${status} successfully`,
      status: status,
    });
  });
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, city, location } = req.body;

  const sql =
    'UPDATE stations SET StationName = ?, City = ?, location = ? WHERE id = ?';
  db.query(sql, [name, city, location, id], (err, result) => {
    if (err) {
      console.error('Error updating station:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: 'Station not found' });

    res.json({ message: 'Station updated successfully' });
  });
});

router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE  FROM stations WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error('Error deleting station:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ message: 'Station not found' });

    res.json({ message: 'Station deleted successfully' });
  });
});

export default router;
