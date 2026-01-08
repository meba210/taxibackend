import express from 'express';
import { sendSMS } from '../services/smsService.js';

const router = express.Router();

router.post('/send-sms', async (req, res) => {
  const { phone, message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Phone and message are required' });
  }

  try {
    const result = await sendSMS(phone, message);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'SMS failed' });
  }
});

export default router;
