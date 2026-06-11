import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Button } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Build packet</Button>);
    expect(screen.getByRole("button", { name: "Build packet" })).toBeTruthy();
  });

  it("uses the primary (ink) variant by default", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button").className).toContain("bg-ink");
  });

  it("applies the secondary variant", () => {
    render(<Button variant="secondary">Go</Button>);
    expect(screen.getByRole("button").className).toContain("border-border");
  });

  it("can be disabled", () => {
    render(
      <Button disabled>
        Go
      </Button>,
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
