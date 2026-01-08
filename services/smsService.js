import axios from 'axios';

export async function sendSMS(phone, message) {
  try {
    const response = await axios.post(
      'https://api.afromessage.com/api/send',
      {
        to: phone,
        message: message,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.AFROMESSAGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('SMS Error:', error.response?.data || error.message);
    throw error;
  }
}
