import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "../../components/dashboard/Dashboard";
import { PlanPanel } from "../../components/plan/PlanPanel";
import { TaskPanel } from "../../components/tasks/TaskPanel";
import type { Task } from "../../lib/domain/types";

const dashboard = { workspace: { id: "workspace-1", slug: "public", title: "Public", timezone: "Asia/Seoul", createdAt: "2026-09-07T00:00:00Z" }, currentPlan: null, tasks: [], executionRecords: [], reviews: [], metrics: { planTaskCount: 1, completedCount: 1, delayedCount: 0, blockedCount: 0, expectedMinutes: 30, actualMinutes: 20, differenceMinutes: -10, taskIdsByMetric: { plan: [], completed: [], delayed: [], blocked: [] } } };
const task: Task = { id: "task-1", planId: "plan-1", title: "논문 읽기", dueDate: null, priority: 1, tag: "research", estimatedMinutes: 30, status: "todo", blockedReason: null, completedAt: null, deletedAt: null, createdAt: "2026-09-07T00:00:00Z", updatedAt: "2026-09-07T00:00:00Z" };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("public dashboard", () => {
  it("shows the public warning and real metric buttons after API data loads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(dashboard), { status: 200 })));
    render(<Dashboard />);
    expect(screen.getByRole("status")).toHaveTextContent("불러오는 중");
    await waitFor(() => expect(screen.getByText(/로그인 기능이 없습니다/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "완료 1개 필터 적용" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "지연 0개 필터 적용" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계획 1개 필터 적용" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "막힘 0개 필터 적용" })).toBeInTheDocument();
    expect(screen.getByText("필요: 계획 1개")).toBeInTheDocument();
    expect(screen.getByText("필요: 할 일 5개")).toBeInTheDocument();
    expect(screen.getByText("필요: 실제 실행 기록 3건")).toBeInTheDocument();
  });

  it("derives every real-data checklist item from dashboard records", async () => {
    const completeDashboard = {
      ...dashboard,
      currentPlan: { id: "plan-1", workspaceId: "workspace-1", title: "준비", startDate: "2026-09-07", endDate: "2026-10-07", priority: 1, successCriteria: "기록", estimatedMinutes: 0, createdAt: "2026-09-07T00:00:00Z", updatedAt: "2026-09-07T00:00:00Z", archivedAt: null },
      tasks: Array.from({ length: 5 }, (_, index) => ({ ...task, id: `task-${index}` })),
      executionRecords: Array.from({ length: 3 }, (_, index) => ({ id: `record-${index}`, taskId: "task-1", startedAt: "2026-09-07T00:00:00Z", endedAt: "2026-09-07T00:01:00Z", actualMinutes: 1, missedReason: null, idempotencyKey: `00000000-0000-4000-8000-00000000000${index}`, createdAt: "2026-09-07T00:01:00Z" })),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(completeDashboard), { status: 200 })));
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("완료: 계획 1개")).toBeInTheDocument());
    expect(screen.getByText("완료: 할 일 5개")).toBeInTheDocument();
    expect(screen.getByText("완료: 실제 실행 기록 3건")).toBeInTheDocument();
  });

  it("renders no-login notice on the first render without a live database", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<Dashboard />);
    expect(screen.getByText(/로그인 기능이 없습니다/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("switches between planner workspaces without leaving the dashboard", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(dashboard), { status: 200 })));
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "오늘의 커리어 플래너" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "실행 할 일과 기록" }));

    expect(screen.getByRole("heading", { name: "실행" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "실행 목록" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "오늘의 커리어 플래너" })).not.toBeInTheDocument();
  });

  it("uses a sanitized retryable error state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "internal database credentials" }), { status: 500 })));
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).not.toHaveTextContent("credentials");
    expect(screen.getByRole("button", { name: /다시 불러오기/ })).toBeInTheDocument();
  });

  it("creates a no-plan form through the API with the public workspace and refetches", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "plan-1" }), { status: 201 }));
    const refreshDashboard = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);
    render(<PlanPanel plan={null} workspaceId="workspace-1" refreshDashboard={refreshDashboard} onError={vi.fn()} />);
    expect(screen.getByRole("form", { name: "새 계획 양식" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("계획 제목"), { target: { value: "실제 준비 계획" } });
    fireEvent.change(screen.getByLabelText("시작일"), { target: { value: "2026-09-07" } });
    fireEvent.change(screen.getByLabelText("종료일"), { target: { value: "2026-09-30" } });
    fireEvent.change(screen.getByLabelText("성공 기준"), { target: { value: "실제 결과를 기록한다" } });
    fireEvent.click(screen.getByRole("button", { name: "계획 만들기" }));
    await waitFor(() => expect(refreshDashboard).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/plans", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ workspaceId: "workspace-1", title: "실제 준비 계획" });
  });

  it("keeps blank accessible Seoul-local inputs and reuses an idempotency key after completion failure", async () => {
    const key = "11111111-1111-4111-8111-111111111111";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "internal" }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => key) });
    render(<TaskPanel planId="plan-1" tasks={[task]} metricTaskIds={["task-1"]} refreshDashboard={vi.fn().mockResolvedValue(undefined)} onError={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /논문 읽기 완료 기록 열기/ }));
    const start = screen.getByLabelText("시작 시각") as HTMLInputElement;
    const end = screen.getByLabelText("종료 시각") as HTMLInputElement;
    expect(start).toBeRequired(); expect(end).toBeRequired();
    expect(start.value).toBe(""); expect(end.value).toBe("");
    fireEvent.change(start, { target: { value: "2026-09-07T09:00" } });
    fireEvent.change(end, { target: { value: "2026-09-07T10:30" } });
    fireEvent.click(screen.getByRole("button", { name: "완료 저장" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("form", { name: /완료 시간 기록/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "완료 저장" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const first = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const retry = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(first).toMatchObject({ startedAt: "2026-09-07T09:00:00+09:00", endedAt: "2026-09-07T10:30:00+09:00", idempotencyKey: key });
    expect(retry.idempotencyKey).toBe(first.idempotencyKey);
  });
});
