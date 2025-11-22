
import jwt from "jsonwebtoken";
import { app, db } from "./server.js"; 
import { promisify } from "util";
import dotenv from "dotenv";
import stationsRouter from "./stations.js";
import stationAdminsRouter from "./stationAdmins.js";
import routesRouter from "./routes.js";
import dispachersRouter from "./dispachers.js";
import taxiAssignmentRouter from "./taxiAssignment.js";
import  taxisRouter from "./taxis.js";
import PassengerQueueRouter  from "./PassengerQueue.js";


dotenv.config();


app.use("/stations", stationsRouter);
app.use("/stationAdmins", stationAdminsRouter);
app.use("/routes", routesRouter);
app.use("/dispachers", dispachersRouter);
app.use("/taxiAssignment", taxiAssignmentRouter);
app.use("/taxis", taxisRouter);
app.use("/passengerqueue", PassengerQueueRouter);





const query = promisify(db.query).bind(db);
app.post("/auth/login", async (req, res) => {
  const { UserName, Password } = req.body;
  if (!UserName || !Password)
    return res.status(400).json({ message: "Username and password required" });

  try {
    // 1️⃣ Check stationadmins
    const adminResults = await query(
      "SELECT id, UserName, Password, role_id FROM stationadmins WHERE UserName = ?",
      [UserName]
    );
    if (adminResults.length > 0) {
      const admin = adminResults[0];
      if (Password !== admin.Password)
        return res.status(400).json({ message: "Incorrect password" });

      // Include stationId in JWT
       const token = jwt.sign(
        { id: admin.id, role: "stationAdmin" },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.json({ message: "Login successful", role: "stationAdmin", token });
    }

    // 2️⃣ Check dispachers
    const dispatcherResults = await query(
      "SELECT id, UserName, Password, role_id FROM dispachers WHERE UserName = ?",
      [UserName]
    );
    if (dispatcherResults.length > 0) {
      const dispatcher = dispatcherResults[0];
      if (Password !== dispatcher.Password)
        return res.status(400).json({ message: "Incorrect password" });

      const token = jwt.sign({ id: dispatcher.id, role: "dispacher" }, process.env.JWT_SECRET, { expiresIn: "1d" });
      return res.json({ message: "Login successful", role: "dispacher", token });
    }

    // 3️⃣ Check roles table for admin/user
    const userResults = await query(
      "SELECT id, UserName, Password, role FROM roles WHERE UserName = ?",
      [UserName]
    );
    if (userResults.length > 0) {
      const user = userResults[0];
      if (Password !== user.Password)
        return res.status(400).json({ message: "Incorrect password" });

      const roleName = user.role === "admin" ? "admin" : "unknown";
      const token = jwt.sign({ id: user.id, role: roleName }, process.env.JWT_SECRET, { expiresIn: "1d" });
      return res.json({ message: "Login successful", role: roleName, token });
    }

    // User not found anywhere
    return res.status(400).json({ message: "User not found" });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "DB error", details: err });
  }
});

// ✅ Token Middleware
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1]; // "Bearer token"

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid Token" });
    req.user = decoded; // stationAdmin {id, role, stationId}
    next();
  });
}


// function verifyStationAdmin(req, res, next) {
//   if (req.user.role !== "stationAdmin")
//     return res.status(403).json({ message: "Forbidden: Station Admins only" });
//   next();
// }

// app.get("/routes/mine", verifyToken, verifyStationAdmin, async (req, res) => {
//   try {
//     const StationAdmins_id = req.user.StationAdmins_id;
//     const routes = await query("SELECT * FROM routes WHERE StationAdmins_id = ?", [StationAdmins_id]);
//     res.json(routes);
//   } catch (err) {
//     res.status(500).json({ message: "DB error", error: err });
//   }
// });


// ✅ Example protected route
app.get("/auth/admin", verifyToken, (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Forbidden" });
  res.json({ message: "✅ Admin Access Granted" });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0",() =>
  console.log(` Server running at http://localhost:${PORT}`)
);

export { query };
