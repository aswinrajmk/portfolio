// Minimal Telegram Bot API client. Messages use HTML parse mode, so all dynamic text goes through `esc`.

export interface InlineButton {
  text: string;
  callback_data: string;
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Telegram caps messages at 4096 characters. */
const clip = (s: string, max = 4000) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export class Telegram {
  constructor(
    private readonly token: string,
    private readonly api = "https://api.telegram.org",
  ) {}

  private async call<T>(method: string, body: Record<string, unknown> | FormData): Promise<T | null> {
    const isForm = body instanceof FormData;
    const response = await fetch(`${this.api}/bot${this.token}/${method}`, {
      method: "POST",
      headers: isForm ? undefined : { "Content-Type": "application/json" },
      body: isForm ? body : JSON.stringify(body),
    });
    const json = (await response.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null;
    if (!json?.ok) {
      console.warn(`[telegram] ${method} failed: ${json?.description ?? response.status}`);
      return null;
    }
    return json.result ?? null;
  }

  sendMessage(chatId: string, html: string, buttons?: InlineButton[][]) {
    return this.call<{ message_id: number }>("sendMessage", {
      chat_id: chatId,
      text: clip(html),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
    });
  }

  sendPhoto(chatId: string, jpeg: ArrayBuffer, captionHtml: string) {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", clip(captionHtml, 1000));
    form.append("parse_mode", "HTML");
    form.append("photo", new Blob([jpeg], { type: "image/jpeg" }), "failure.jpg");
    return this.call("sendPhoto", form);
  }

  sendTyping(chatId: string) {
    return this.call("sendChatAction", { chat_id: chatId, action: "typing" });
  }

  answerCallback(callbackId: string, text: string) {
    return this.call("answerCallbackQuery", { callback_query_id: callbackId, text: clip(text, 190) });
  }

  /** Removes the buttons from a message once its action has been decided. */
  clearButtons(chatId: string, messageId: number) {
    return this.call("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });
  }
}
