/// <reference types="@cloudflare/workers-types" />

/** Bindings and secrets available to every Pages Function (see wrangler.toml and .dev.vars.example). */
export interface Env {
  DB: D1Database;
  UPLOADS: R2Bucket;
  /** Static files of the site (Pages built-in). */
  ASSETS: Fetcher;
  /** Dashboard password — set with `wrangler pages secret put ADMIN_PASSWORD`. */
  ADMIN_PASSWORD: string;
  /** Long random string used to sign admin sessions. */
  SESSION_SECRET: string;
  /** Web Push (phone notifications). Generate with `npm run setup:secrets`. */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

export type Fn<P extends string = never> = PagesFunction<Env, P>;
