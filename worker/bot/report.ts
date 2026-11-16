import type { RunDetail } from "../../shared/results";
import { getRun, getScreenshot } from "../api/store";
import { reportConfig } from "./config";
import { esc, Telegram } from "./telegram";

const ICON: Record<string, string> = {
  passed: "✅",
  failed: "❌",
  healed: "🩹",
  skipped: "⏭️",
  incomplete: "⚠️",
  running: "⏳",
};

export function formatRunReport(run: RunDetail, publicUrl: string): string {
  const { passed, failed, healed, skipped } = run.counts;
  const lines = [
    `${ICON[run.status] ?? ""} <b>${esc(run.project)}: ${run.status.toUpperCase()}</b>`,
    `${passed} passed · ${failed} failed · ${healed} healed · ${skipped} skipped`,
    `Commit <code>${esc((run.commitSha ?? "").slice(0, 7) || "n/a")}</code> ${esc(run.commitMessage ?? "")}`,
    `Trigger: ${run.trigger === "deploy" ? "app deploy" : "manual"}`,
  ];
  const failures = run.tests.filter((t) => t.status === "failed");
  if (failures.length) {
    lines.push("", "<b>Failed</b>");
    for (const t of failures.slice(0, 5)) {
      const first = (t.error?.message ?? "").split("\n").find((l) => l.trim()) ?? "";
      lines.push(`❌ ${esc(t.title)}`, `   <i>${esc(first.slice(0, 160))}</i>`);
    }
  }
  const heals = run.tests.filter((t) => t.status === "healed");
  if (heals.length) {
    lines.push("", "<b>Healed</b>");
    for (const t of heals.slice(0, 5)) {
      lines.push(`🩹 ${esc(t.title)}`);
      if (t.healing) lines.push(`   fix: <code>${esc(t.healing.suggestion)}</code>`);
    }
  }
  lines.push("", `<a href="${publicUrl}/dashboard/run/?id=${run.id}">Open the full report</a>`);
  return lines.join("\n");
}

/** Posts a finished run to the report channel. Never throws: reporting must not break the API. */
export async function postRunReport(env: Env, runId: string): Promise<void> {
  const cfg = reportConfig(env);
  if (!cfg) return;
  try {
    const run = await getRun(env.DB, runId);
    if (!run) return;
    const telegram = new Telegram(cfg.botToken, cfg.telegramApi);
    await telegram.sendMessage(cfg.chatId, formatRunReport(run, cfg.publicUrl));
    const firstShot = run.tests.find((t) => t.status === "failed" && t.hasScreenshot);
    if (firstShot) {
      const image = await getScreenshot(env.DB, firstShot.id);
      if (image) await telegram.sendPhoto(cfg.chatId, image, `❌ ${esc(firstShot.title)}`);
    }
  } catch (e) {
    console.warn(`[report] could not post run ${runId}: ${String(e)}`);
  }
}
