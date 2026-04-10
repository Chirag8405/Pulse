import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox } from "lucide-react";
import { describe, expect, test, vi } from "vitest";
import { EmptyState } from "@/components/shared/EmptyState";

describe("EmptyState", () => {
  test("renders title and description", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No active challenge"
        description="The next challenge starts soon."
      />
    );

    expect(screen.getByText("No active challenge")).toBeInTheDocument();
    expect(screen.getByText("The next challenge starts soon.")).toBeInTheDocument();
  });

  test("renders action button when provided", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No data"
        description="Try again"
        action={{ label: "Retry", onClick: () => undefined }}
      />
    );

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  test("does not render button when action not provided", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No data"
        description="Try again"
      />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("action button calls onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <EmptyState
        icon={Inbox}
        title="No data"
        description="Try again"
        action={{ label: "Retry", onClick }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
