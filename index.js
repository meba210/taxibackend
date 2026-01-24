import jwt from 'jsonwebtoken';
import { app, db } from './server.js';
import { promisify } from 'util';
import dotenv from 'dotenv';
import stationsRouter from './stations.js';
import stationAdminsRouter from './stationAdmins.js';
import routesRouter from './routes.js';
import dispachersRouter from './dispachers.js';
import taxiAssignmentRouter from './taxiAssignment.js';
import taxisRouter from './taxis.js';
import PassengerQueueRouter from './PassengerQueue.js';
import dispacherRouteRouter from './dispacherRoute.js';
import taxiQueueRouter from './taxiQueue.js';
import assignTaxisRouter from './assignTaxis.js';
import smsRoutes from './routes/sms.js';
import allusersRouter from './allusers.js';

dotenv.config();

app.use('/stations', stationsRouter);
app.use('/stationAdmins', stationAdminsRouter);
app.use('/routes', routesRouter);
app.use('/dispachers', dispachersRouter);
app.use('/taxiAssignment', taxiAssignmentRouter);
app.use('/taxis', taxisRouter);
app.use('/passengerqueue', PassengerQueueRouter);
app.use('/dispacher-route', dispacherRouteRouter);
app.use('/taxi-queue', taxiQueueRouter);
app.use('/assignTaxis', assignTaxisRouter);
app.use('/api', smsRoutes);
app.use('/allUsers', allusersRouter);

const query = promisify(db.query).bind(db);

app.post('/auth/login', async (req, res) => {
  const { UserName, Password } = req.body;
  if (!UserName || !Password)
    return res.status(400).json({ message: 'Username and password required' });

  try {
    const adminResults = await query(
      `
      SELECT 
        s.id,
        s.UserName,
        s.Password,
        s.status AS userStatus,
        s.mustChangePassword,
        st.status AS stationStatus
      FROM stationadmins s
      LEFT JOIN stations st 
       ON LOWER(TRIM(st.StationName)) = LOWER(TRIM(s.Stations))
      WHERE s.UserName = ?
      `,
      [UserName]
    );

    console.log(req.body, '=========== ', adminResults);

    if (adminResults.length > 0) {
      const admin = adminResults[0];

      if (admin.userStatus !== 1) {
        return res.status(403).json({
          message: 'Your account is inactive. Contact admin.',
        });
      }

      if (admin.stationStatus !== 'active') {
        return res.status(403).json({
          message: 'Your station is inactive. Access denied.',
        });
      }

      if (Password !== admin.Password) {
        return res.status(400).json({ message: 'Incorrect password' });
      }

      const token = jwt.sign(
        { id: admin.id, role: 'stationAdmin' },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.json({
        message: 'Login successful',
        role: 'stationAdmin',
        token,
        userId: admin.id,
        mustChangePassword: admin.mustChangePassword === 1,
      });
    }
    const dispatcherResults = await query(
      `
  SELECT 
    d.id,
    d.UserName,
    d.Password,
    d.Routes,
    d.status AS userStatus,
    d.mustChangePassword,
    st.status AS stationStatus
  FROM dispachers d
  LEFT JOIN stations st
    ON LOWER(TRIM(st.StationName)) = LOWER(TRIM(SUBSTRING_INDEX(d.Routes, ' → ', 1)))
  WHERE d.UserName = ?
  `,
      [UserName]
    );

    if (dispatcherResults.length > 0) {
      const dispatcher = dispatcherResults[0];
      if (dispatcher.userStatus !== 1) {
        return res.status(403).json({
          message: 'Your account is inactive. Contact admin.',
        });
      }

      if (!dispatcher.stationStatus || dispatcher.stationStatus !== 'active') {
        return res.status(403).json({
          message: 'Your station is inactive. Access denied.',
        });
      }

      if (Password !== dispatcher.Password) {
        return res.status(400).json({ message: 'Incorrect password' });
      }

      const token = jwt.sign(
        { id: dispatcher.id, role: 'dispacher' },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.json({
        message: 'Login successful',
        role: 'dispacher',
        token,
        userId: dispatcher.id,
        mustChangePassword: dispatcher.mustChangePassword === 1,
        route: dispatcher.Routes,
      });
    }

    if (dispatcherResults.length > 0) {
      const dispatcher = dispatcherResults[0];

      if (dispatcher.userStatus !== 1) {
        return res.status(403).json({
          message: 'Your account is inactive. Contact admin.',
        });
      }

      if (Password !== dispatcher.Password) {
        return res.status(400).json({ message: 'Incorrect password' });
      }

      const token = jwt.sign(
        { id: dispatcher.id, role: 'dispatcher' },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.json({
        message: 'Login successful',
        role: 'dispatcher',
        token,
        userId: dispatcher.id,
        mustChangePassword: dispatcher.mustChangePassword === 1,
      });
    }

    const adminRoleResults = await query(
      'SELECT id, UserName, Password, role FROM roles WHERE UserName = ?',
      [UserName]
    );

    if (adminRoleResults.length > 0) {
      const user = adminRoleResults[0];

      if (Password !== user.Password) {
        return res.status(400).json({ message: 'Incorrect password' });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.json({
        message: 'Login successful',
        role: user.role,
        token,
      });
    }

    return res.status(400).json({ message: 'User not found' });
  } catch (err) {
    return res.status(500).json({ message: 'DB error', details: err });
  }
});

export function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader)
    return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid Token' });
    req.user = decoded;
    next();
  });
}

app.get('/auth/admin', verifyToken, (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });
  res.json({ message: '✅ Admin Access Granted' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () =>
  console.log(` Server running at http://localhost:${PORT}`)
);

export { query };
