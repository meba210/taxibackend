import express from 'express';
import { query } from './index.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        'stationadmin' as user_type,
        sa.id,
        sa.FullName,
        sa.Email,
        sa.PhoneNumber,
        sa.UserName,
        'Station Admin' AS Role,
        CASE 
          WHEN sa.status = 1 THEN 'Active'
          ELSE 'Inactive'
        END AS status
      FROM stationadmins sa
      
      UNION ALL
      
      SELECT
        'dispatcher' as user_type,
        d.id,
        d.FullName,
        d.Email,
        d.PhoneNumber,
        d.UserName,
        'Dispatcher' AS Role,
        CASE 
          WHEN d.status = 1 THEN 'Active'
          ELSE 'Inactive'
        END AS status
      FROM dispachers d
      ORDER BY user_type, id
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

router.put('/:role/:id/status', async (req, res) => {
  const { role, id } = req.params;
  const { isActive } = req.body;

  try {
    let tableName = '';
    if (role === 'stationadmin') tableName = 'stationadmins';
    else if (role === 'dispatcher') tableName = 'dispachers';
    else return res.status(400).json({ message: 'Invalid role' });

    const statusValue = isActive === true ? 1 : 0;

    const result = await query(
      `UPDATE ${tableName} SET status = ? WHERE id = ?`,
      [statusValue, id]
    );

    res.json({
      message: 'Status updated successfully',
      status: statusValue === 1 ? 'Active' : 'Inactive',
      affectedRows: result.affectedRows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.sqlMessage || err.message });
  }
});

export default router;
