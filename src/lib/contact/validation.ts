import { z } from "zod";

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(100, { message: "Name cannot exceed 100 characters" }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Please provide a valid email address" })
    .max(254, { message: "Email cannot exceed 254 characters" }),
  subject: z
    .string()
    .trim()
    .min(1, { message: "Subject is required" })
    .max(150, { message: "Subject cannot exceed 150 characters" }),
  message: z
    .string()
    .trim()
    .min(1, { message: "Message cannot be empty" })
    .max(5000, { message: "Message cannot exceed 5,000 characters" }),
  browser: z
    .string()
    .trim()
    .max(50, { message: "Browser description cannot exceed 50 characters" })
    .optional()
    .or(z.literal("")),
  // Honeypot field - normal users will never see or fill this
  hp_website: z.string().optional(),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;
