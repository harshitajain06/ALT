import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

type Body = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ verified: true } | { message: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const secret = process.env.RAZORPAY_SECRET;
  if (!secret) {
    console.error("RAZORPAY_SECRET is not set");
    return res.status(500).json({ message: "Payment verification unavailable" });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body as Body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: "Missing payment verification fields" });
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");

  if (expected !== razorpay_signature) {
    return res.status(400).json({ message: "Invalid payment signature" });
  }

  return res.status(200).json({ verified: true });
}
