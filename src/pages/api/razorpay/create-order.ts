import Razorpay from "razorpay";
import type { NextApiRequest, NextApiResponse } from "next";
// import the correct type for Razorpay order
import type { Orders } from "razorpay/dist/types/orders";
type SuccessResponse = {
  orderId: string;
  razorpayKey: string | undefined;
  order: Orders.RazorpayOrder;
};

type ErrorResponse = {
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "POST") return res.status(405).end();

  // Validate environment variables
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_SECRET) {
    console.error("Razorpay credentials are missing. Please set RAZORPAY_KEY_ID and RAZORPAY_SECRET environment variables.");
    return res.status(500).json({
      message: "Payment gateway configuration error. Please contact support.",
    });
  }

  const { amount, currency = "INR", bookingId } = req.body;
  if (!amount) return res.status(400).json({ message: "amount required" });

  // Razorpay requires receipt length ≤ 40 characters
  const rawReceipt =
    typeof bookingId === "string" && bookingId.trim().length > 0
      ? bookingId.trim()
      : `rec_${Date.now()}`;
  const receipt =
    rawReceipt.length > 40 ? rawReceipt.slice(0, 40) : rawReceipt;

  const rzp = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET,
  });

  try {
    const order: Orders.RazorpayOrder = await rzp.orders.create({
      amount,
      currency,
      receipt,
      ...(typeof bookingId === "string" &&
        bookingId.length > 0 && {
          notes: { booking_ref: bookingId.slice(0, 200) },
        }),
      payment_capture: true,
    });

    return res.status(200).json({
      orderId: order.id,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      order,
    });
  } catch (err: any) {
    console.error("Razorpay API error:", err);
    return res.status(500).json({
      message: err?.message ?? "Failed to create payment order. Please try again.",
    });
  }
}