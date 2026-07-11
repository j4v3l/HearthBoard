import { z } from "zod";

export const categorySchema = z.enum(["AI", "Infrastructure", "Media", "Network", "Security"]);
export const checkTypeSchema = z.enum(["HTTP", "Ping", "TCP", "None"]);
export const importModeSchema = z.enum(["append", "updateByName", "skipExisting"]);

export const serviceInputSchema = z.object({
  name: z.string().min(1).describe("Display name for the service"),
  description: z.string().optional().default(""),
  category: categorySchema.default("Infrastructure"),
  url: z.string().optional().default(""),
  healthUrl: z.string().optional().default(""),
  checkType: checkTypeSchema.default("HTTP"),
  icon: z.string().optional().default("Server"),
  statusCheckEnabled: z.boolean().optional().default(true),
});

export const serviceUpdateSchema = serviceInputSchema.partial();

export const settingsUpdateSchema = z.object({
  dashboardName: z.string().min(1).max(80).optional(),
  dashboardSubtitle: z.string().max(80).optional(),
  dashboardIcon: z.string().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "Provide at least one setting to update",
});

export const importServicesSchema = z.object({
  confirm: z.literal(true).describe("Must be true to import services"),
  mode: importModeSchema.default("append"),
  services: z.array(serviceInputSchema).min(1).max(500),
});

export const deleteServiceSchema = z.object({
  id: z.string().min(1),
  confirm: z.literal(true).describe("Must be true to delete a service"),
});

export const reorderServicesSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).describe("Complete list of service IDs in the desired order"),
});

export const checkAllServicesSchema = z.object({
  confirm: z.literal(true).describe("Must be true because this triggers outbound network checks for every service"),
});
