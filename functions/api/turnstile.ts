export class Turnstile {
  constructor(private secretKey: string) {}

  async verify(token: string, remoteip?: string): Promise<TurnstileResponse> {
    if (!this.secretKey) {
      throw new Error("Turnstile secret key is empty");
    }
    if (!token) {
      throw new Error("Turnstile token is empty");
    }

    const formData = new FormData();
    formData.append("secret", this.secretKey);
    formData.append("response", token);
    if (remoteip && remoteip !== "unknown") {
      formData.append("remoteip", remoteip);
    }

    console.log(
      "[Turnstile] Calling siteverify with secret:",
      this.secretKey.substring(0, 10) + "...",
    );

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      },
    );

    console.log("[Turnstile] siteverify response status:", response.status);

    const result = await response.json();
    console.log("[Turnstile] siteverify response:", result);

    return result as TurnstileResponse;
  }
}

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}
