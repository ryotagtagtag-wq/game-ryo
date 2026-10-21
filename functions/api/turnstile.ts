export class Turnstile {
  constructor(private secretKey: string) {}

  async verify(token: string, remoteip?: string): Promise<TurnstileResponse> {
    const formData = new FormData();
    formData.append("secret", this.secretKey);
    formData.append("response", token);
    if (remoteip && remoteip !== "unknown") {
      formData.append("remoteip", remoteip);
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      },
    );

    return response.json() as Promise<TurnstileResponse>;
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
