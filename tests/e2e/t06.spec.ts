import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

type DashboardResponse = { currentPlan: { id: string; title: string } | null };
type TaskResponse = { id: string; title: string };
type ExportResponse = { plans: Array<{ id: string; title: string }>; tasks: Array<{ id: string; title: string; status: string }>; executionRecords: Array<{ id: string; taskId: string }>; diaryEntries?: Array<{ metricName: string; entryOrigin: string }> };

const e2eEmail = process.env.E2E_USER_EMAIL;
const e2ePassword = process.env.E2E_USER_PASSWORD;
const hasSupabaseConfig = Boolean(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
) || existsSync(".env.local") || existsSync(".env");
const hasE2EConfig = Boolean(
  hasSupabaseConfig &&
  e2eEmail &&
  e2ePassword,
);

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(e2eEmail ?? "");
  await page.getByLabel("비밀번호").fill(e2ePassword ?? "");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("내 작업공간")).toBeVisible();
}

async function addTask(page: Page, title: string, tag: string): Promise<void> {
  await page.getByRole("button", { name: "할 일 추가" }).click();
  const form = page.getByRole("form", { name: "새 할 일 양식" });
  await form.getByLabel("할 일 제목").fill(title);
  await form.getByLabel("태그").fill(tag);
  await form.getByLabel("우선순위").fill("1");
  await form.getByLabel("예상 시간(분)").fill("15");
  await form.getByRole("button", { name: "할 일 추가" }).click();
  await expect(page.getByRole("button", { name: `${title} 완료 기록 열기` })).toBeVisible();
}

test.describe("T07 live Supabase integration", () => {
  test.skip(!hasE2EConfig, "Set Supabase browser env vars and E2E_USER_EMAIL/E2E_USER_PASSWORD for a live test account.");

  test("T07 authenticated Plan–Do–See data persists safely", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });

  await login(page);
  const initialDashboard = await page.request.get("/api/dashboard");
  expect(initialDashboard.ok()).toBeTruthy();
  const initial = await initialDashboard.json() as DashboardResponse;
  expect(initial.currentPlan).not.toBeNull();
  const originalPlanId = initial.currentPlan!.id;

  await page.getByRole("button", { name: "계획 목표와 기준" }).click();
  await expect(page.getByRole("heading", { name: "계획" })).toBeVisible();
  await page.getByRole("button", { name: "현재 계획 수정 양식 열기" }).click();
  const planForm = page.getByRole("form", { name: "계획 수정 양식" });
  const revisedTitle = `T06 계획 수정 ${Date.now()}`;
  await planForm.getByLabel("계획 제목").fill(revisedTitle);
  await planForm.getByRole("button", { name: "계획 저장" }).click();
  await expect(page.getByText(revisedTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(/이전 값 #\d+:/)).toBeVisible();

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const taskTitles = Array.from({ length: 5 }, (_, index) => `T06 작업 ${index + 1} ${suffix}`);
  await page.getByRole("button", { name: "실행 할 일과 기록" }).click();
  await expect(page.getByRole("heading", { name: "실행" })).toBeVisible();
  for (const [index, title] of taskTitles.entries()) await addTask(page, title, index % 2 === 0 ? "t06-search" : "t06-filter");
  const scriptTitle = "<script>alert(1)</script>";
  await addTask(page, scriptTitle, "t06-safety");
  await expect(page.getByText(scriptTitle, { exact: true })).toBeVisible();
  expect(dialogs).toEqual([]);

  await page.locator(".filter-details summary").click();
  const toolbar = page.getByLabel("할 일 검색 및 필터");
  await toolbar.getByLabel("할 일 검색").fill(taskTitles[0]);
  await expect(page.getByText(taskTitles[0], { exact: true })).toBeVisible();
  await expect(page.getByText(taskTitles[1], { exact: true })).toHaveCount(0);
  await toolbar.getByLabel("할 일 검색").fill("");
  await toolbar.getByLabel("태그").fill("t06-filter");
  await expect(page.getByText(taskTitles[1], { exact: true })).toBeVisible();
  await expect(page.getByText(taskTitles[0], { exact: true })).toHaveCount(0);
  await toolbar.getByLabel("태그").fill("");
  await toolbar.getByLabel("정렬").selectOption("estimated_minutes");
  await toolbar.getByLabel("정렬 방향").selectOption("desc");
  await expect(page.getByText("현재 정렬: estimated_minutes · desc")).toBeVisible();

  const completedTitle = taskTitles[0];
  await page.getByRole("button", { name: `${completedTitle} 완료 기록 열기` }).click();
  const completionForm = page.getByRole("form", { name: `${completedTitle} 완료 시간 기록` });
  await completionForm.getByLabel("시작 시각").fill("2026-09-07T09:00");
  await completionForm.getByLabel("종료 시각").fill("2026-09-07T09:30");
  const firstCompletion = page.waitForResponse((response) => response.url().includes("/complete") && response.request().method() === "POST");
  await completionForm.getByRole("button", { name: "완료 저장" }).click();
  const firstResponse = await firstCompletion;
  expect(firstResponse.ok()).toBeTruthy();
  const firstRecord = await firstResponse.json() as { id: string };
  const repeatedResponse = await page.request.post(new URL(firstResponse.url()).pathname, { data: firstResponse.request().postDataJSON() });
  expect(repeatedResponse.ok()).toBeTruthy();
  expect((await repeatedResponse.json() as { id: string }).id).toBe(firstRecord.id);

  const afterCompletion = await page.request.get("/api/export");
  const afterCompletionExport = await afterCompletion.json() as ExportResponse;
  const completedTask = afterCompletionExport.tasks.find((task) => task.title === completedTitle);
  expect(completedTask).toBeDefined();
  expect(afterCompletionExport.executionRecords.filter((record) => record.taskId === completedTask!.id)).toHaveLength(1);
  await expect(page.getByRole("button", { name: `${completedTitle} 진행 중으로 되돌리기` })).toBeVisible();
  await page.getByRole("button", { name: `${completedTitle} 진행 중으로 되돌리기` }).click();
  await expect(page.getByRole("button", { name: "완료 0개 필터 적용" })).toBeVisible();

  await page.getByRole("button", { name: "회고 결과와 다음 계획" }).click();
  await expect(page.getByRole("heading", { name: "회고" })).toBeVisible();
  await page.getByRole("button", { name: /^계획 .* 원본 할 일 보기$/ }).click();
  await expect(page.getByText("돌아보기 지표 원본만 표시")).toBeVisible();
  await expect(page.getByText(completedTitle, { exact: true })).toBeVisible();

  await page.locator(".correction-details summary").click();
  const correctionForm = page.getByRole("form", { name: "개선점 다음 계획 반영" });
  const nextTitle = `T06 다음 계획 ${suffix}`;
  await correctionForm.getByLabel("개선점").fill("실제 기록을 바탕으로 다음 계획의 시간을 조정한다.");
  await correctionForm.getByLabel("다음 계획 제목").fill(nextTitle);
  await correctionForm.getByLabel("다음 계획 시작일").fill("2026-10-08");
  await correctionForm.getByLabel("다음 계획 종료일").fill("2026-10-14");
  await correctionForm.getByLabel("예상 시간(분)").fill("60");
  await correctionForm.getByLabel("다음 계획 성공 기준").fill("실제 결과를 기록한다.");
  await correctionForm.getByRole("button", { name: "다음 계획으로 넘기기" }).click();
  await expect(page.getByText(/개선점을 다음 계획에 반영했습니다/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(nextTitle, { exact: true })).toBeVisible();
  const persistedExportResponse = await page.request.get("/api/export");
  const persistedExport = await persistedExportResponse.json() as ExportResponse;
  expect(persistedExport.plans.some((plan) => plan.id === originalPlanId && plan.title === revisedTitle)).toBeTruthy();
  expect(persistedExport.tasks.some((task) => task.id === completedTask!.id && task.status === "in_progress")).toBeTruthy();
  expect(persistedExport.executionRecords.filter((record) => record.taskId === completedTask!.id)).toHaveLength(1);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 내보내기" }).first().click();
  expect((await download).suggestedFilename()).toBe("pds-export-v2.json");
  expect(dialogs).toEqual([]);
  });

  test("T07 authenticated diary keeps five dates and source labels in export", async ({ page }) => {

  await login(page);
  const metricName = `e2e-diary-${Date.now()}`;
  const dates = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(Date.now() - (4 - index) * 86_400_000);
    return date.toISOString().slice(0, 10);
  });

  for (const [index, recordDate] of dates.entries()) {
    const response = await page.request.post("/api/diary", {
      data: {
        recordDate,
        question: "집중 시간을 어떻게 개선했는가?",
        metricName,
        unit: "분",
        value: 42 + index * 5,
        calculationRule: "실제 집중 작업 시간을 합산한다.",
        planRuleVersion: index < 2 ? 1 : 2,
        planRule: index < 2 ? "오전 집중 블록을 지킨다." : "오전·오후 집중 블록을 지킨다.",
        ruleChangeReason: index < 2 ? null : "오후 블록을 추가했다.",
      },
    });
    expect(response.status()).toBe(201);
  }

  const exportedResponse = await page.request.get("/api/export");
  expect(exportedResponse.ok()).toBeTruthy();
  const exported = await exportedResponse.json() as ExportResponse;
  const diaryEntries = exported.diaryEntries?.filter((entry) => entry.metricName === metricName) ?? [];
  expect(diaryEntries).toHaveLength(5);
  expect(diaryEntries.every((entry) => entry.entryOrigin === "user_entered")).toBeTruthy();

  await page.reload();
  await expect(page.getByRole("heading", { name: "5일 기록과 계획 규칙" })).toBeVisible();
  await expect(page.getByText("5일", { exact: true })).toBeVisible();
  });
});
