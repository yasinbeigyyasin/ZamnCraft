import { expect, type Locator } from "@playwright/test";

export async function choose(
  control: Locator,
  value: string | { label: string },
) {
  if ((await control.getAttribute("role")) === "combobox") {
    await control.click();
    const popup = control.page().getByRole("listbox", {
      name: (await control.getAttribute("aria-label"))!,
      exact: true,
    });
    await (
      typeof value === "string"
        ? popup.locator(`[data-value="${value}"]`)
        : popup.getByRole("option", { name: value.label, exact: true })
    ).click();
  } else {
    await control.locator(`[data-value="${value}"]`).click();
  }
}
export async function expectChoice(control: Locator, value: string) {
  await expect(control.locator(`[data-value="${value}"]`)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}
