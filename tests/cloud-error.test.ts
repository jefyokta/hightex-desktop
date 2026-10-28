import { afterEach, expect, test } from "bun:test";
import { CloudError as MainCloudError } from "../electron/exception/cloud-error";
import { ShouldSendToRenderer } from "../electron/exception/should-send-to-renderer";
import { CloudError } from "../src/exception/cloud-error";
import { ShouldNotified } from "../src/exception/interfaces/should-notified";
import { reconstructMainError } from "../src/decorators/error-name";
import { getCloudErrorCode } from "../sharable-types/cloud-error";
import { setCurrentLanguage, t } from "../src/utils/lang";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
afterEach(() => {
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  setCurrentLanguage("en");
});

test("cloud failures use the app main-process error class with a machine-readable code", () => {
  const error = new MainCloudError("integrity_failed");
  expect(error).toBeInstanceOf(ShouldSendToRenderer);
  expect(error.code).toBe("integrity_failed");
  expect(getCloudErrorCode(error)).toBe("integrity_failed");
});

for (const language of ["id", "en"] as const) {
  test(`cloud errors use ${language} locale messages and the app notification error class`, () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { config: { get: () => ({ language }) } },
    });
    setCurrentLanguage(language);
    const error = new CloudError("integrity_failed");
    expect(error).toBeInstanceOf(ShouldNotified);
    expect(error.description).toBe(t("cloud.errors.integrity_failed"));
    expect(error.message).toBe(t("cloud.error_title"));
    expect(error.code).toBe("integrity_failed");
    const ipc = reconstructMainError(
      new Error(
        "Error invoking remote method 'cloud:pull': Error: CloudError:integrity_failed",
      ),
      () => new CloudError("request_failed"),
    );
    expect(ipc).toBeInstanceOf(CloudError);
    expect((ipc as CloudError).description).toBe(error.description);
    expect(getCloudErrorCode(ipc)).toBe("integrity_failed");
  });
}

test("unknown failures use a localized fallback without displaying raw exception text", () => {
  const error = CloudError.from(
    new Error("internal details must not be user-facing"),
  );
  expect(error.code).toBe("request_failed");
  expect(error.description).toBe(t("cloud.errors.request_failed"));
  expect(error.description).not.toContain("internal details");
  expect(CloudError.from(new MainCloudError("http_503")).description).toBe(
    t("cloud.errors.request_failed"),
  );
});
