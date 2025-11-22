const express = require("express");
const router = express.Router();
const TaxiStations = require("../models/TaxiStations");

// Get all taxi stations
router.get("/", async (req, res) => {
  try {
    const stations = await TaxiStations.find();
    res.json(stations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.post("/", async (req, res) => {
  const { name, latitude, longitude } = req.body;
  const station = new TaxiStations({ name, latitude, longitude });
  try {
    const saved = await station.save();
    res.json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
