import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import type { Detection } from "@/api/contracts";
import messages from "@/messages/en-CA.json";
import { DetectionOverlay } from "./detection-overlay";
import { validateImage } from "./image-utils";

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en-CA" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );

describe("DetectionOverlay", () => {
  it("renders nothing when the model returned no detections", () => {
    const { container } = wrap(<DetectionOverlay detections={[]} decisions={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("positions boxes exactly from the API response", () => {
    const detections: Detection[] = [{ id: "d1", label: "blocked_curb_ramp", confidence: 0.82, box: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } }];
    wrap(<DetectionOverlay detections={detections} decisions={{}} />);
    const box = screen.getByTestId("detection-box");
    expect(box.style.left).toBe("10%");
    expect(box.style.top).toBe("20%");
    expect(box.style.width).toBe("30%");
    expect(box.style.height).toBe("40%");
    expect(box).toHaveTextContent("Blocked curb ramp 82%");
  });
});

describe("validateImage", () => {
  const file = (type: string, size: number, name = "photo") => new File([new Uint8Array(size)], name, { type });

  it("accepts common photo formats", () => {
    expect(validateImage(file("image/jpeg", 1000))).toBeNull();
    expect(validateImage(file("", 1000, "IMG_0001.HEIC"))).toBeNull();
  });

  it("rejects other files and very large images", () => {
    expect(validateImage(file("application/pdf", 1000, "doc.pdf"))).toBe("invalidType");
    expect(validateImage(file("image/jpeg", 16 * 1024 * 1024))).toBe("tooLarge");
  });
});
