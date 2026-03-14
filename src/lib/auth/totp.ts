import { TOTP } from "otplib";
import qrcode from "qrcode";

const totp = new TOTP();

export function generateTotpSecret(): string {
  return totp.generateSecret();
}

export async function verifyTotpToken(secret: string, token: string): Promise<boolean> {
  try {
    // otplib v13: verify(token, options) where options includes secret
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (totp as any).verify(token, { secret });
    return !!result;
  } catch {
    return false;
  }
}

export async function generateTotpQrCode(
  email: string,
  secret: string,
  appName: string = "Meta Ads Platform"
): Promise<string> {
  const otpAuth = totp.toURI({ label: email, issuer: appName, secret });
  return qrcode.toDataURL(otpAuth);
}
