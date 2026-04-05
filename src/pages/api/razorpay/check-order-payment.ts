import Razorpay from "razorpay";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Server-side check: UPI/QR flows sometimes complete without the client `handler`
 * firing reliably. Uses Razorpay Orders API to see if any payment is captured/authorized.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    | { razorpay_order_id: string; razorpay_payment_id: string }
    | { message: string }
  >
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_SECRET;
  if (!keyId || !secret) {
    return res.status(500).json({ message: "Payment configuration error" });
  }

  const { orderId } = req.body as { orderId?: string };
  if (!orderId || typeof orderId !== "string") {
    return res.status(400).json({ message: "orderId required" });
  }

  const rzp = new Razorpay({ key_id: keyId, key_secret: secret });

  try {
    const { items } = await rzp.orders.fetchPayments(orderId);
    const paid = items.find(
      (p) => p.status === "captured" || p.status === "authorized"
    );
    if (!paid?.id) {
      return res.status(404).json({
        message: "No completed payment for this order yet",
      });
    }

    return res.status(200).json({
      razorpay_order_id: orderId,
      razorpay_payment_id: paid.id,
    });
  } catch (err: unknown) {
    console.error("check-order-payment:", err);
    return res.status(500).json({
      message: "Could not check payment status",
    });
  }
}
