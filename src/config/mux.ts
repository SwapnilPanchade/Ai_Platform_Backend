import Mux from "@mux/mux-node";
import dotenv from "dotenv";
import logger from "../utils/logger";
import { error } from "console";

dotenv.config();

const tokenId = process.env.MUX_TOKEN_ID;
const tokenSecret = process.env.MUX_TOKEN_SECRET;

if (!tokenId || !tokenSecret) {
  logger.fatal("MUX_TOKEN_ID or MUX_TOKEN_SECRET is not set");
  throw new Error("MUX API credientials are not configured");
}

export const muxClient = new Mux({
  tokenId: tokenId,
  tokenSecret: tokenSecret,
});

logger.info("Mux client configured.");

// You can export specific parts if needed, e.g.,
export const { video } = muxClient;
