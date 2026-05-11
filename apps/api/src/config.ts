export interface AppConfig {
  port: number;
  allowedOrigin: string;
  paymentProvider: string;
  paymentSettlementDays: number;
}

export const config: AppConfig = {
  port: Number(process.env.API_PORT ?? 4000),
  allowedOrigin: process.env.ALLOWED_ORIGIN ?? "http://localhost:5173",
  paymentProvider: process.env.PAYMENT_PROVIDER ?? "stripe",
  paymentSettlementDays: Number(process.env.PAYMENT_SETTLEMENT_DAYS ?? 2)
};
