import axios from "axios";


export async function sendSMS(phone, message) {
    console.log("SENDER:", process.env.AFROMESSAGE_SENDER);
console.log("KEY EXISTS:", process.env.AFROMESSAGE_API_KEY);

console.log("Token:", process.env.AFROMESSAGE_API_KEY);
console.log("Token parts:", process.env.AFROMESSAGE_API_KEY.split('.').length);

  try {
    const response = await axios.post(
      "https://api.afromessage.com/api/send",
      {
        to: phone,
        message: message,
        // sender: process.env.AFROMESSAGE_SENDER
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.AFROMESSAGE_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error("SMS Error:", error.response?.data || error.message);
    throw error;
  }
}

// module.exports = { sendSMS };
