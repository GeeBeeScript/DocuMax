import { z } from "zod";

export const CheckoutSchema = z.object({
  plan: z.enum(["pro", "business"]),
  interval: z.enum(["monthly", "yearly"]),
});
