import { num } from "starknet";

export class Utils {
  static show(data: any) {
    console.log(
      JSON.stringify(
        data,
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2
      )
    );
  }

  static decodeShortString(shortStringHex: string): string {
    let hex = shortStringHex.startsWith("0x")
      ? shortStringHex.slice(2)
      : shortStringHex;

    // Ensure even length
    if (hex.length % 2 !== 0) {
      hex = "0" + hex;
    }

    let result = "";
    for (let i = 0; i < hex.length; i += 2) {
      const byteHex = hex.substr(i, 2);
      const byte = parseInt(byteHex, 16);
      if (byte === 0) break; // Null terminator
      result += String.fromCharCode(byte);
    }

    return result.trim();
  }

  static normalizeEventData(
    eventData: Record<string, any>
  ): Record<string, string> {
    const normalized: Record<string, string> = {};

    for (const [key, value] of Object.entries(eventData)) {
      if (typeof value === "string") {
        // Case 1: Already a proper hex address (starts with 0x and valid length)
        if (value.startsWith("0x") && value.length >= 66) {
          normalized[key] = value; // keep as-is
        }
        // Case 2: Looks like a decimal felt (very long number string, no 0x)
        else if (
          !isNaN(value as any) &&
          value.length > 15 &&
          BigInt(value) > 0
        ) {
          try {
            normalized[key] = num.toHex(BigInt(value));
          } catch {
            normalized[key] = value; // fallback if conversion fails
          }
        }
        // Case 3: Regular string (name, description, etc.)
        else {
          normalized[key] = value;
        }
      }
      // Handle numbers or other types (rare in events)
      else if (typeof value === "bigint") {
        normalized[key] = num.toHex(value);
      } else {
        normalized[key] = String(value);
      }
    }

    return normalized;
  }

  static getEventType(fullEventName: string): string {
    const parts = fullEventName.split("::");
    return parts[parts.length - 1];
  }
}
