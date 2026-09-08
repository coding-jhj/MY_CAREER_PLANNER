import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExecutionForm } from "../../components/execution/ExecutionForm";
import { ExportButton } from "../../components/export/ExportButton";
import { ReviewPanel } from "../../components/review/ReviewPanel";
import type { Plan, Task } from "../../lib/domain/types";

const key = "11111111-1111-4111-8111-111111111111";
const task: Task = { id: "task-1", planId: "plan-1", title: "실제 실험 기록", dueDate: null, priority: 1, tag: "experiment", estimatedMinutes: 90, status: "todo", blockedReason: null, completedAt: null, deletedAt: null, createdAt: "2026-09-07T00:00:00Z", updatedAt: "2026-09-07T00:00:00Z" };
const plan: Plan = { id: "plan-1", workspaceId: "workspace-1", title: "계획", startDate: "2026-09-07", endDate: "2026-09-30", priority: 1, successCriteria: "기록", estimatedMinutes: 90, createdAt: "2026-09-07T00:00:00Z", updatedAt: "2026-09-07T00:00:00Z", archivedAt: null };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("execution and review UI", () => {
  it("retries the same deliberate completion payload with its original idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "retry" }), { status: 500 })); vi.stubGlobal("fetch", fetchMock);
    render(<ExecutionForm task={task} mode="complete" idempotencyKey={key} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("시작 시각"), { target: { value: "2026-09-07T09:00" } }); fireEvent.change(screen.getByLabelText("종료 시각"), { target: { value: "2026-09-07T10:30" } }); fireEvent.change(screen.getByLabelText(/문제·미실행 이유/), { target: { value: "실제 중단 사유" } });
    fireEvent.click(screen.getByRole("button", { name: "완료 저장" })); await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "완료 저장" })); await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const first = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)); const second = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(first).toEqual({ startedAt: "2026-09-07T09:00:00+09:00", endedAt: "2026-09-07T10:30:00+09:00", missedReason: "실제 중단 사유", idempotencyKey: key }); expect(second).toEqual(first);
  });

  it("shows one server-calculated duration after a successful execution save", async () => {
    const saved = { id: "execution-1", taskId: task.id, startedAt: "2026-09-07T09:00:00+09:00", endedAt: "2026-09-07T10:30:00+09:00", actualMinutes: 90, missedReason: null, idempotencyKey: key, createdAt: "2026-09-07T01:30:00Z" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(saved), { status: 200 })); const onSaved = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<ExecutionForm task={task} mode="record" idempotencyKey={key} onSaved={onSaved} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("시작 시각"), { target: { value: "2026-09-07T09:00" } }); fireEvent.change(screen.getByLabelText("종료 시각"), { target: { value: "2026-09-07T10:30" } }); fireEvent.click(screen.getByRole("button", { name: "실행 기록 저장" }));
    await waitFor(() => expect(screen.getAllByText("실행 기록을 저장했습니다. 서버 계산 실제 소요 시간: 90분")).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith(`/api/tasks/${task.id}/executions`, expect.objectContaining({ method: "POST" })); expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("uses review source IDs for a drill-down and confirms correction only after success", async () => {
    const review = { metrics: { planTaskCount: 1, completedCount: 0, delayedCount: 0, blockedCount: 0, expectedMinutes: 90, actualMinutes: 0, differenceMinutes: -90, taskIdsByMetric: { plan: ["task-1"], completed: [], delayed: [], blocked: [] } } };
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(review), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify(review), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ review: { nextPlanId: "plan-2" }, nextPlan: { id: "plan-2" } }), { status: 201 })).mockResolvedValueOnce(new Response(JSON.stringify(review), { status: 200 })); vi.stubGlobal("fetch", fetchMock);
    const onDrillDown = vi.fn(); render(<ReviewPanel plan={plan} workspaceId="workspace-1" tasks={[task]} onDrillDown={onDrillDown} refreshDashboard={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "계획 1개 원본 할 일 보기" })).toBeInTheDocument()); fireEvent.click(screen.getByRole("button", { name: "계획 1개 원본 할 일 보기" })); await waitFor(() => expect(onDrillDown).toHaveBeenCalledWith(["task-1"]));
    fireEvent.change(screen.getByLabelText("개선점"), { target: { value: "평가 시간을 더 확보한다" } }); fireEvent.change(screen.getByLabelText("다음 계획 제목"), { target: { value: "다음 실제 계획" } }); fireEvent.change(screen.getByLabelText("다음 계획 시작일"), { target: { value: "2026-10-01" } }); fireEvent.change(screen.getByLabelText("다음 계획 종료일"), { target: { value: "2026-10-31" } }); fireEvent.change(screen.getByLabelText("다음 계획 성공 기준"), { target: { value: "평가 결과를 기록한다" } });
    fireEvent.click(screen.getByRole("button", { name: "다음 계획으로 넘기기" })); await waitFor(() => expect(screen.getByText(/개선점을 다음 계획에 반영했습니다/)).toBeInTheDocument());
    const correctionCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/corrections")); expect(JSON.parse(String(correctionCall?.[1]?.body))).toMatchObject({ correctionText: "평가 시간을 더 확보한다", nextPlan: { workspaceId: "workspace-1", title: "다음 실제 계획" } });
  });

  it("downloads the export using the server content-disposition filename", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const createObjectURL = vi.fn(() => "blob:export"); const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "Content-Disposition": "attachment; filename=\"pds-export-v2.json\"" } })));
    render(<ExportButton />); fireEvent.click(screen.getByRole("button", { name: "JSON 내보내기" }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(createObjectURL).toHaveBeenCalledOnce(); expect(revokeObjectURL).toHaveBeenCalledWith("blob:export");
    click.mockRestore();
  });
});
